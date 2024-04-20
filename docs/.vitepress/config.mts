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

export default defineConfig({
  title: "Fedify",
  description: "Fedify docs",
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Installation", link: "/install.md" },
      { text: "Tutorial", link: "/tutorial.md" },
      { text: "Manual", link: "/manual.md", activeMatch: "/manual" },
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
        text: "Manual",
        link: "/manual.md",
        items: [
          { text: "Federation", link: "/manual/federation.md" },
          { text: "Context", link: "/manual/context.md" },
          { text: "Vocabulary", link: "/manual/vocab.md" },
          { text: "Actor dispatcher", link: "/manual/actor.md" },
          { text: "Inbox listeners", link: "/manual/inbox.md" },
          { text: "Sending activities", link: "/manual/send.md" },
          { text: "Collections", link: "/manual/collections.md" },
          { text: "Access control", link: "/manual/access-control.md" },
          { text: "NodeInfo", link: "/manual/nodeinfo.md" },
          { text: "Pragmatics", link: "/manual/pragmatics.md" },
          { text: "Integration", link: "/manual/integration.md" },
          { text: "Testing", link: "/manual/test.md" },
          { text: "Logging", link: "/manual/log.md" },
        ],
      },
      {
        text: "Examples",
        link: "https://github.com/dahlia/fedify/tree/main/examples",
      },
      { text: "Contribute", link: "/contribute.md" },
      { text: "Changelog", link: "/changelog.md" },
    ],

    socialLinks: [
      { icon: "matrix", link: "https://matrix.to/#/#fedify:matrix.org" },
      { icon: "deno", link: "https://jsr.io/@fedify/fedify" },
      { icon: "npm", link: "https://www.npmjs.com/package/@fedify/fedify" },
      { icon: "github", link: "https://github.com/dahlia/fedify" },
    ],

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/dahlia/fedify/edit/main/docs/:path",
    },
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
  outline: "deep",
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
