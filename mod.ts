/**
 * Fedify: a fediverse server framework
 * ====================================
 *
 * Fedify is a [Deno]/TypeScript library for building federated server apps
 * powered by [ActivityPub] and other standards, which is so-called [fediverse].
 * It aims to eliminate the complexity and redundant boilerplate code when
 * building a federated server app, so that you can focus on your business
 * logic and user experience.
 *
 * Currently, Fedify is moving fast and the API is not stable yet.  We do not
 * recommend using it in production yet, so please use it if you would like to
 * experiment with it and help us improve it.
 *
 * The rough roadmap is to implement the following features out of the box:
 *
 * - Type-safe objects for [Activity Vocabulary] (including some vendor-specific
 *   extensions)
 * - [WebFinger] client and server
 * - [HTTP Signatures]
 * - Middlewares for handling webhooks
 * - [ActivityPub] client
 * - [NodeInfo] protocol
 * - Special touch for interoperability with Mastodon and few other popular
 *   fediverse software
 *
 * If you want to know more about the project, please take a look at the
 * following resources:
 *
 * - [GitHub](https://github.com/dahlia/fedify)
 * - [Manual](https://fedify.dev/manual/)
 *   ([Unstable](https://unstable.fedify.dev/manual/))
 * - [Examples](https://github.com/dahlia/fedify/tree/main/examples)
 *
 * [Deno]: https://deno.com/
 * [ActivityPub]: https://www.w3.org/TR/activitypub/
 * [fediverse]: https://en.wikipedia.org/wiki/Fediverse
 * [Activity Vocabulary]: https://www.w3.org/TR/activitystreams-vocabulary/
 * [WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
 * [HTTP Signatures]: https://tools.ietf.org/html/draft-cavage-http-signatures-12
 * [NodeInfo]: https://nodeinfo.diaspora.software/
 *
 * @module
 */
export * from "./federation/mod.ts";
export * from "./httpsig/mod.ts";
export * from "./nodeinfo/mod.ts";
export * from "./runtime/mod.ts";
export * from "./vocab/mod.ts";
export { lookupWebFinger, type ResourceDescriptor } from "./webfinger/mod.ts";
