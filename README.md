<!-- deno-fmt-ignore-file -->

![](./logo.svg)
Fedify: a fediverse server framework
====================================

[![JSR][JSR badge]][JSR]
[![JSR score][JSR score badge]][JSR score]
[![GitHub Actions][GitHub Actions badge]][GitHub Actions]

> [!NOTE]
> Looking for a quick demo?  Here it is: [Fedify Demo] on Deno Playground.

Fedify is a [Deno]/TypeScript library for building federated server apps
powered by [ActivityPub] and other standards, so-called [fediverse].[^1]
It aims to eliminate the complexity and redundant boilerplate code when
building a federated server app, so that you can focus on your business logic
and user experience.

Currently, Fedify is moving fast and the API is not stable yet.  We do not
recommend using it in production yet, so please use it if you would like to
experiment with it and help us improve it.

The rough roadmap is to implement the following features out of the box:

 -  Type-safe objects for [Activity Vocabulary] (including some vendor-specific
    extensions)
 -  [WebFinger] client and server
 -  [HTTP Signatures]
 -  Middlewares for handling webhooks
 -  [ActivityPub] client
 -  [NodeInfo] protocol
 -  Special touch for interoperability with Mastodon and few other popular
    fediverse software

If you want to know more about the project, please take a look at the following
resources:

 -  [JSR]
 -  [Manual](https://dahlia.github.io/fedify/manual/)
 -  [API reference](https://jsr.io/@fedify/fedify/doc)
 -  [Examples](https://github.com/dahlia/fedify/tree/main/examples)

[^1]: You may already know some of the networks in the fediverse, such as
      [Mastodon], [Lemmy], [Pixelfed], [PeerTube], and so on.

[JSR]: https://jsr.io/@fedify/fedify
[JSR badge]: https://jsr.io/badges/@fedify/fedify
[JSR score]: https://jsr.io/@fedify/fedify/score
[JSR score badge]: https://jsr.io/badges/@fedify/fedify/score
[GitHub Actions]: https://github.com/dahlia/fedify/actions/workflows/build.yaml
[GitHub Actions badge]: https://github.com/dahlia/fedify/actions/workflows/build.yaml/badge.svg
[Fedify Demo]: https://dash.deno.com/playground/fedify-demo
[Deno]: https://deno.com/
[ActivityPub]: https://www.w3.org/TR/activitypub/
[fediverse]: https://en.wikipedia.org/wiki/Fediverse
[Activity Vocabulary]: https://www.w3.org/TR/activitystreams-vocabulary/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[HTTP Signatures]: https://tools.ietf.org/html/draft-cavage-http-signatures-12
[NodeInfo]: https://nodeinfo.diaspora.software/
[Mastodon]: https://joinmastodon.org/
[Lemmy]: https://join-lemmy.org/
[Pixelfed]: https://pixelfed.org/
[PeerTube]: https://joinpeertube.org/


Installation
------------

As a prerequisite, you need to have [Deno] 1.41.0 or later installed on your
system.  Then you can install Fedify via the following command:

~~~~ sh
deno add @fedify/fedify
~~~~

~~~~ typescript
import { Federation } from "@fedify/fedify";
~~~~

Or you can directly import it in your code using `jsr:` specifier:

~~~~ typescript
import { Federation } from "jsr:@fedify/fedify";
~~~~
