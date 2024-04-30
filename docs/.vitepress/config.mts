import { Presets, SingleBar } from "cli-progress";
import deflist from "markdown-it-deflist";
import footnote from "markdown-it-footnote";
import { jsrRef } from "markdown-it-jsr-ref";
import process from "node:process";
import { defineConfig } from "vitepress";

const progress = new SingleBar({}, Presets.shades_classic);
let started = false;

const jsrRefPlugin = await jsrRef({
  package: "@fedify/fedify",
  version: "unstable",
  cachePath: ".jsr-cache.json",
  progress: (complete: number, total: number) => {
    if (started) progress.update(complete);
    else {
      started = true;
      progress.start(total, complete);
    }
  },
});

let extraNav: { text: string; link: string }[] = [];
if (process.env.EXTRA_NAV_TEXT && process.env.EXTRA_NAV_LINK) {
  extraNav = [
    {
      text: process.env.EXTRA_NAV_TEXT,
      link: process.env.EXTRA_NAV_LINK,
    },
  ];
}

let plausibleScript: [string, Record<string, string>][] = [];
if (process.env.PLAUSIBLE_DOMAIN) {
  plausibleScript = [
    [
      "script",
      {
        defer: "defer",
        "data-domain": process.env.PLAUSIBLE_DOMAIN,
        src: "https://plausible.io/js/plausible.js",
      },
    ],
  ];
}

const MANUAL = {
  text: "Manual",
  items: [
    { text: "Federation", link: "/manual/federation.md" },
    { text: "Context", link: "/manual/context.md" },
    { text: "Vocabulary", link: "/manual/vocab.md" },
    { text: "Actor dispatcher", link: "/manual/actor.md" },
    { text: "Inbox listeners", link: "/manual/inbox.md" },
    { text: "Sending activities", link: "/manual/send.md" },
    { text: "Collections", link: "/manual/collections.md" },
    { text: "Object dispatcher", link: "/manual/object.md" },
    { text: "Access control", link: "/manual/access-control.md" },
    { text: "NodeInfo", link: "/manual/nodeinfo.md" },
    { text: "Pragmatics", link: "/manual/pragmatics.md" },
    { text: "Integration", link: "/manual/integration.md" },
    { text: "Testing", link: "/manual/test.md" },
    { text: "Logging", link: "/manual/log.md" },
  ],
  activeMatch: "/manual",
};

export default defineConfig({
  title: "Fedify",
  description: "Fedify docs",
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Installation", link: "/install.md" },
      { text: "Tutorial", link: "/tutorial.md" },
      { text: "CLI", link: "/cli.md" },
      MANUAL,
      { text: "API reference", link: "https://jsr.io/@fedify/fedify" },
      ...extraNav,
    ],

    sidebar: [
      { text: "What is Fedify?", link: "/intro.md" },
      {
        text: "Quick demo",
        link: "https://dash.deno.com/playground/fedify-demo",
      },
      { text: "Installation", link: "/install.md" },
      { text: "Tutorial", link: "/tutorial.md" },
      {
        text: "CLI toolchain",
        link: "/cli.md",
      },
      MANUAL,
      {
        text: "Examples",
        link: "https://github.com/dahlia/fedify/tree/main/examples",
      },
      { text: "Contribute", link: "/contribute.md" },
      { text: "Changelog", link: "/changelog.md" },
    ],

    socialLinks: [
      {
        icon: {
          svg:
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Matrix</title><path d="M.632.55v22.9H2.28V24H0V0h2.28v.55zm7.043 7.26v1.157h.033c.309-.443.683-.784 1.117-1.024.433-.245.936-.365 1.5-.365.54 0 1.033.107 1.481.314.448.208.785.582 1.02 1.108.254-.374.6-.706 1.034-.992.434-.287.95-.43 1.546-.43.453 0 .872.056 1.26.167.388.11.716.286.993.53.276.245.489.559.646.951.152.392.23.863.23 1.417v5.728h-2.349V11.52c0-.286-.01-.559-.032-.812a1.755 1.755 0 0 0-.18-.66 1.106 1.106 0 0 0-.438-.448c-.194-.11-.457-.166-.785-.166-.332 0-.6.064-.803.189a1.38 1.38 0 0 0-.48.499 1.946 1.946 0 0 0-.231.696 5.56 5.56 0 0 0-.06.785v4.768h-2.35v-4.8c0-.254-.004-.503-.018-.752a2.074 2.074 0 0 0-.143-.688 1.052 1.052 0 0 0-.415-.503c-.194-.125-.476-.19-.854-.19-.111 0-.259.024-.439.074-.18.051-.36.143-.53.282-.171.138-.319.337-.439.595-.12.259-.18.6-.18 1.02v4.966H5.46V7.81zm15.693 15.64V.55H21.72V0H24v24h-2.28v-.55z"/></svg>',
        },
        link: "https://matrix.to/#/#fedify:matrix.org",
        ariaLabel: "Matrix",
      },
      {
        icon: {
          svg:
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>JSR</title><path d="M3.692 5.538v3.693H0v7.384h7.385v1.847h12.923v-3.693H24V7.385h-7.385V5.538Zm1.846 1.847h1.847v7.384H1.846v-3.692h1.846v1.846h1.846zm3.693 0h5.538V9.23h-3.692v1.846h3.692v5.538H9.231V14.77h3.692v-1.846H9.231Zm7.384 1.846h5.539v3.692h-1.846v-1.846h-1.846v5.538h-1.847z"/></svg>',
        },
        link: "https://jsr.io/@fedify/fedify",
        ariaLabel: "JSR",
      },
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/@fedify/fedify",
        ariaLabel: "npm",
      },
      {
        icon: "github",
        link: "https://github.com/dahlia/fedify",
        ariaLabel: "GitHub",
      },
    ],

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/dahlia/fedify/edit/main/docs/:path",
    },

    outline: "deep",
  },

  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/favicon-192x192.png",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
    ],
    [
      "meta",
      {
        property: "og:image",
        content:
          "https://repository-images.githubusercontent.com/766072261/03a63032-03aa-481e-aa31-091809a49043",
      },
    ],
    ...plausibleScript,
  ],

  cleanUrls: true,
  ignoreDeadLinks: true,
  markdown: {
    config: (md) => {
      md.use(deflist);
      md.use(footnote);
      md.use(jsrRefPlugin);
    },
  },

  async transformHead(context) {
    return [
      [
        "meta",
        { property: "og:title", content: context.title },
      ],
      [
        "meta",
        { property: "og:description", content: context.description },
      ],
    ];
  },
});
