import lume from "lume/mod.ts";
import lumocs from "lumocs/mod.ts";
import relativeUrls from "lume/plugins/relative_urls.ts";
import title from "lume_markdown_plugins/title.ts";
import image from "lume_markdown_plugins/image.ts";
import externalLinks from "npm:markdown-it-external-links@0.0.6";
import callouts from "npm:markdown-it-obsidian-callouts@0.2.3";
import { maxWith } from "@std/collections";
import { compare, format, parse, SemVer } from "@std/semver";

const site = lume({}, {
  markdown: {
    plugins: [
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

async function getApiSymbols(
  version: string,
): Promise<Record<string, SymbolType>> {
  const kv = await Deno.openKv();
  const cache = await kv.get<Record<string, SymbolType>>(["api", version]);
  if (cache != null && cache.value != null) return cache.value;
  const response = await fetch(
    `https://jsr.io/api/scopes/fedify/packages/fedify/versions/${
      encodeURIComponent(version)
    }/docs/search`,
  );
  const json = await response.json();
  const types = Object.fromEntries(
    json.nodes.map(
      (node: { name: string; kind: SymbolType[] }) => [node.name, node.kind[0]],
    ),
  );
  await kv.set(["api", version], types);
  return types;
}

async function getApiUrl(
  version: string,
  symbol: string,
  attr?: string,
): Promise<string | null> {
  const baseUrl = `https://jsr.io/@fedify/fedify@${version}/doc/~/${symbol}`;
  if (attr == null) return baseUrl;
  const kv = await Deno.openKv();
  const cache = await kv.get<Record<string, string>>(["api", version, symbol]);
  let anchors: Record<string, string>;
  if (
    cache != null && cache.value != null && Array.isArray(cache.value) &&
    cache.value.length > 0
  ) {
    anchors = cache.value;
  } else {
    const response = await fetch(baseUrl, {
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
    await kv.set(["api", version, symbol], anchors);
  }
  if (attr in anchors) return `${baseUrl}#${anchors[attr]}`;
  return null;
}

const version = await getPackageVersion();
const symbols = await getApiSymbols(version);

site.process([".html"], async (pages) => {
  const pattern =
    /^(~)?([A-Za-z][A-Za-z0-9]*)(?:\.([a-z][A-Za-z0-9]*))?(\(\))?$/;
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
        if (symbols[symbol] == null) continue;
        const apiUrl = await getApiUrl(
          version,
          symbol,
          attr,
        );
        if (apiUrl == null) continue;
        const link = page.document.createElement("a");
        link.setAttribute("href", apiUrl);
        code.parentNode!.replaceChild(link, code);
        code.innerText = prefix == null
          ? `${symbol}${attr == null ? "" : `.${attr}`}${parens ?? ""}`
          : `${attr}${parens ?? ""}`;
        link.appendChild(code);
      }
    }
  }
});

export default site;
