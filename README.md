<!-- deno-fmt-ignore-file -->

![](./logo.svg)
Fedify: an ActivityPub server framework
=======================================

[![JSR][JSR badge]][JSR]
[![npm][npm badge]][npm]
[![GitHub Actions][GitHub Actions badge]][GitHub Actions]
[![Matrix][Matrix badge]][Matrix]
[![Follow @fedify@hollo.social][@fedify@hollo.social badge]][@fedify@hollo.social]

> [!NOTE]
> Looking for a quick demo?  Here it is: [Fedify Demo] on Deno Playground.

Fedify is a TypeScript library for building federated server apps
powered by [ActivityPub] and other standards, so-called [fediverse].[^1]
It aims to eliminate the complexity and redundant boilerplate code when
building a federated server app, so that you can focus on your business logic
and user experience.

Currently, Fedify provides the following features out of the box:

 -  Type-safe objects for [Activity Vocabulary] (including some vendor-specific
    extensions)
 -  [WebFinger] client and server
 -  [HTTP Signatures]
 -  [Object Integrity Proofs][FEP-8b32]
 -  Middlewares for handling webhooks
 -  [NodeInfo] protocol
 -  Special touch for interoperability with Mastodon and few other popular
    fediverse software
 -  CLI toolchain for testing and debugging

If you want to know more about the project, please take a look at the following
resources:

 -  [Tutorial](https://fedify.dev/tutorial)
 -  [API reference][JSR]
 -  [Examples](https://github.com/dahlia/fedify/tree/main/examples)

If you have any questions, suggestions, or feedback, please feel free to
join our [Matrix chat space][Matrix] or [GitHub Discussions].  Or tag
[#Fedify] in the fediverse!

[^1]: You may already know some of the networks in the fediverse, such as
      [Mastodon], [Lemmy], [Pixelfed], [PeerTube], and so on.

[JSR]: https://jsr.io/@fedify/fedify
[JSR badge]: https://jsr.io/badges/@fedify/fedify
[npm]: https://www.npmjs.com/package/@fedify/fedify
[npm badge]: https://img.shields.io/npm/v/@fedify/fedify?logo=npm
[GitHub Actions]: https://github.com/dahlia/fedify/actions/workflows/build.yaml
[GitHub Actions badge]: https://github.com/dahlia/fedify/actions/workflows/build.yaml/badge.svg
[Matrix]: https://matrix.to/#/#fedify:matrix.org
[Matrix badge]: https://img.shields.io/matrix/fedify%3Amatrix.org
[@fedify@hollo.social badge]: https://fedi-badge.deno.dev/@fedify@hollo.social/followers.svg
[@fedify@hollo.social]: https://hollo.social/@fedify
[Fedify Demo]: https://dash.deno.com/playground/fedify-demo
[ActivityPub]: https://www.w3.org/TR/activitypub/
[fediverse]: https://en.wikipedia.org/wiki/Fediverse
[Activity Vocabulary]: https://www.w3.org/TR/activitystreams-vocabulary/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[HTTP Signatures]: https://tools.ietf.org/html/draft-cavage-http-signatures-12
[FEP-8b32]: https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md
[NodeInfo]: https://nodeinfo.diaspora.software/
[GitHub Discussions]: https://github.com/dahlia/fedify/discussions
[#Fedify]: https://elk.zone/mastodon.social/tags/fedify
[Mastodon]: https://joinmastodon.org/
[Lemmy]: https://join-lemmy.org/
[Pixelfed]: https://pixelfed.org/
[PeerTube]: https://joinpeertube.org/


Installation
------------

Fedify is available on [JSR] for [Deno] and on [npm] for [Node.js] and [Bun].

> [!TIP]
> We recommend using Deno or Bun (which are TypeScript-first) for the best
> experience, but you can use Node.js if you prefer.

[JSR]: https://jsr.io/@fedify/fedify
[Deno]: https://deno.com/
[npm]: https://www.npmjs.com/package/@fedify/fedify
[Node.js]: https://nodejs.org/
[Bun]: https://bun.sh/

### Deno

[Deno] is the primary runtime for Fedify.  As a prerequisite, you need to have
Deno 1.41.0 or later installed on your system.  Then you can install Fedify
via the following command:

~~~~ sh
deno add @fedify/fedify
~~~~

Since Fedify requires [`Temporal`] API, which is an unstable feature in Deno as
of May 2024, you need to add the `"temporal"` to the `"unstable"` field of
the *deno.json* file:

~~~~ json
{
  "imports": {
    "@fedify/fedify": "jsr:@fedify/fedify"
  },
  "unstable": ["temporal"]
}
~~~~

[`Temporal`]: https://tc39.es/proposal-temporal/docs/

### Node.js

Fedify can also be used in Node.js.  As a prerequisite, you need to have Node.js
20.0.0 or later installed on your system.  Then you can install Fedify via
the following command:

~~~~ sh
npm add @fedify/fedify
~~~~

Fedify is an ESM-only package, so you need to add `"type": "module"` to the
*package.json* file:

~~~~ json
{
  "type": "module",
  "dependencies": {
    "@fedify/fedify": "^0.11.0"
  }
}
~~~~

### Bun

Fedify can also be used in Bun.  You can install it via the following
command:

~~~~ sh
bun add @fedify/fedify
~~~~
