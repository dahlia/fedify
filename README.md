<!-- deno-fmt-ignore-file -->

![](./logo.svg)
Fedify: an ActivityPub server framework
=======================================

[![JSR][JSR badge]][JSR]
[![npm][npm badge]][npm]
[![GitHub Actions][GitHub Actions badge]][GitHub Actions]
[![Matrix][Matrix badge]][Matrix]
[![Discord][Discord badge]][Discord]
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
 -  [Object Integrity Proofs][FEP-8b32] & [Linked Data Signatures]
 -  Middlewares for handling webhooks
 -  [NodeInfo] protocol
 -  Special touch for interoperability with Mastodon and few other popular
    fediverse software
 -  Integration with various web frameworks
 -  CLI toolchain for testing and debugging

If you want to know more about the project, please take a look at the following
resources:

 -  [Installation](https://fedify.dev/install)
 -  Tutorials:
    [Learning the basics](https://fedify.dev/tutorial/basics) &
    [Creating a microblog](https://fedify.dev/tutorial/microblog)
 -  [API reference][JSR]
 -  [Examples](https://github.com/fedify-dev/fedify/tree/main/examples)

If you have any questions, suggestions, or feedback, please feel free to
join our [Matrix chat space][Matrix] or [Discord server][Discord] or
[GitHub Discussions].  Or tag [#Fedify] in the fediverse!

[^1]: You may already know some of the networks in the fediverse, such as
      [Mastodon], [Lemmy], [Pixelfed], [PeerTube], and so on.

[JSR]: https://jsr.io/@fedify/fedify
[JSR badge]: https://jsr.io/badges/@fedify/fedify
[npm]: https://www.npmjs.com/package/@fedify/fedify
[npm badge]: https://img.shields.io/npm/v/@fedify/fedify?logo=npm
[GitHub Actions]: https://github.com/fedify-dev/fedify/actions/workflows/build.yaml
[GitHub Actions badge]: https://github.com/fedify-dev/fedify/actions/workflows/build.yaml/badge.svg
[Matrix]: https://matrix.to/#/#fedify:matrix.org
[Matrix badge]: https://img.shields.io/matrix/fedify%3Amatrix.org?logo=matrix
[Discord]: https://discord.gg/bhtwpzURwd
[Discord badge]: https://img.shields.io/discord/1295652627505217647?logo=discord&cacheSeconds=60
[@fedify@hollo.social badge]: https://fedi-badge.deno.dev/@fedify@hollo.social/followers.svg
[@fedify@hollo.social]: https://hollo.social/@fedify
[Fedify Demo]: https://dash.deno.com/playground/fedify-demo
[ActivityPub]: https://www.w3.org/TR/activitypub/
[fediverse]: https://en.wikipedia.org/wiki/Fediverse
[Activity Vocabulary]: https://www.w3.org/TR/activitystreams-vocabulary/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[HTTP Signatures]: https://tools.ietf.org/html/draft-cavage-http-signatures-12
[FEP-8b32]: https://w3id.org/fep/8b32
[Linked Data Signatures]: https://web.archive.org/web/20170923124140/https://w3c-dvcg.github.io/ld-signatures/
[NodeInfo]: https://nodeinfo.diaspora.software/
[GitHub Discussions]: https://github.com/fedify-dev/fedify/discussions
[#Fedify]: https://mastodon.social/tags/fedify
[Mastodon]: https://joinmastodon.org/
[Lemmy]: https://join-lemmy.org/
[Pixelfed]: https://pixelfed.org/
[PeerTube]: https://joinpeertube.org/


Sponsors
--------

This project exists thanks to all the people who contribute, donate, and sponsor
it.  We are grateful for their support.  We would like to thank the following
financial contributors:[^2]

[^2]: Those lists are automatically updated every hour.

<!-- cSpell: disable -->
<!-- DO NOT EDIT(h3): this section is automatically generated by the script -->

### Supporters

- [Daniel Supernault](https://pixelfed.org/)
- [tkgka](https://opencollective.com/guest-1b915c65)
- [Blaine](https://opencollective.com/blaine)

### Backers

yamanoku, okin, Andy Piper, box464, Evan Prodromou, Rafael Goulart

### One-time donations

Markus P, Nils Bergmann, Rameez

<!-- /DO NOT EDIT -->
<!-- cSpell: enable -->

### Become a sponsor

We welcome financial contributions to help us maintain and improve this project.
If you would like to become a financial contributor, please visit our
[Open Collective].

[Open Collective]: https://opencollective.com/fedify
