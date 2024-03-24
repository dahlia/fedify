import { maxWith } from "@std/collections";
import { compare, format, parse, SemVer } from "@std/semver";
import lume from "lume/mod.ts";
import relativeUrls from "lume/plugins/relative_urls.ts";
import image from "lume_markdown_plugins/image.ts";
import title from "lume_markdown_plugins/title.ts";
import lumocs from "lumocs/mod.ts";
import externalLinks from "npm:markdown-it-external-links@0.0.6";
import footnote from "npm:markdown-it-footnote@4.0.0";
import callouts from "npm:markdown-it-obsidian-callouts@0.2.3";

const site = lume({}, {
  markdown: {
    plugins: [
      footnote,
      externalLinks,
      callouts,
    ],
  },
});

site.use(relativeUrls());
site.use(lumocs());
site.use(title());
site.use(image());

site.copy("img");
site.copyRemainingFiles();

async function getPackageVersion(): Promise<string> {
  const response = await fetch("https://jsr.io/@fedify/fedify/meta.json");
  const json = await response.json();
  const versions: SemVer[] = [];
  for (const version in json.versions) {
    const meta = json.versions[version];
    if (meta.yanked) continue;
    const parsed = parse(version);
    if (parsed == null) continue;
    versions.push(parsed);
  }
  const latest = maxWith(versions, compare);
  if (latest == null) throw new Error("No versions available");
  return format(latest);
}

export type SymbolType = "typeAlias" | "function" | "class" | "interface";

export interface Node {
  name: string;
  kind: SymbolType[];
  file: string;
  declarationKind: "export" | "private";
}

const kv = await Deno.openKv();

async function getApiNodes(
  version: string,
): Promise<Record<string, Node>> {
  const cache = await kv.get<Record<string, Node>>(["api", version]);
  if (cache != null && cache.value != null) return cache.value;
  const response = await fetch(
    `https://jsr.io/api/scopes/fedify/packages/fedify/versions/${
      encodeURIComponent(version)
    }/docs/search`,
  );
  const json = await response.json();
  const nodes: Node[] = json.nodes;
  const types = Object.fromEntries(
    nodes
      .filter((node) => node.declarationKind === "export")
      .map((node) => [node.name, node]),
  );
  await kv.set(["api", version], types);
  return types;
}

async function getApiUrl(
  version: string,
  node: Node,
  opt: null | { attr: string } | { ctor: true },
): Promise<string | null> {
  const baseUrl = new URL(
    node.file === "." ? "." : `.${node.file}/`,
    `https://jsr.io/@fedify/fedify@${version}/doc/`,
  );
  const url = new URL(`./~/${node.name}`, baseUrl);
  if (opt == null) return url.href;
  const cache = await kv.get<Record<string, string>>([
    "api",
    version,
    node.name,
  ]);
  let anchors: Record<string, string>;
  if (
    cache != null && cache.value != null && Array.isArray(cache.value) &&
    cache.value.length > 0
  ) {
    anchors = cache.value;
  } else {
    const response = await fetch(url, {
      headers: { Accept: "text/html" },
    });
    const html = await response.text();
    const matches = html.matchAll(
      /\sid="((?:call_signature|property|accessor|method)_([A-Za-z_][A-Za-z0-9_]*?)(?:_\d+)?)"/g,
    );
    anchors = {};
    for (const match of matches) {
      anchors[match[2]] = match[1];
    }
    await kv.set(["api", version, node.name], anchors);
  }
  if ("ctor" in opt) return `${url.href}#constructor_0`;
  if (opt.attr in anchors) return `${url.href}#${anchors[opt.attr]}`;
  return null;
}

const version = Deno.env.get("GITHUB_REF_TYPE") === "tag"
  ? Deno.env.get("GITHUB_REF_NAME")!
  : await getPackageVersion();
const nodes = await getApiNodes(version);

site.process([".html"], async (pages) => {
  const pattern =
    /^(~|new\s+)?([A-Za-z][A-Za-z0-9]*)(?:\.([a-z][A-Za-z0-9]*))?(\(\))?$/;
  for (const page of pages) {
    if (page.document != null) {
      for (
        const code of page.document.querySelectorAll<HTMLElement>(
          ":not(a) > :not(a) > code",
        )
      ) {
        if (code.innerText == null || code.innerText.includes("\n")) continue;
        const match = pattern.exec(code.innerText);
        if (match == null) continue;
        const [_, prefix, symbol, attr, parens] = match;
        if (nodes[symbol] == null) continue;
        if (prefix === "new" && (attr != null || parens == null)) continue;
        const apiUrl = await getApiUrl(
          version,
          nodes[symbol],
          prefix?.trim() === "new"
            ? { ctor: true }
            : attr == null
            ? null
            : { attr },
        );
        if (apiUrl == null) continue;
        const link = page.document.createElement("a");
        link.setAttribute("href", apiUrl);
        code.parentNode!.replaceChild(link, code);
        code.innerText = prefix == null
          ? `${symbol}${attr == null ? "" : `.${attr}`}${parens ?? ""}`
          : prefix === "~"
          ? `${attr}${parens ?? ""}`
          : `new ${symbol}()`;
        link.appendChild(code);
      }
    }
  }
});

export default site;

// cSpell: ignore wekanteam
