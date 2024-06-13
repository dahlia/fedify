<!-- deno-fmt-ignore-file -->

Fedify changelog
================

Version 0.9.1
-------------

To be released.


Version 0.9.0
-------------

Released on June 2, 2024.

 -  Added `Tombstone` class to Activity Vocabulary API.

 -  Added `Hashtag` class to Activity Vocabulary API.  [[#48]]

 -  Added `Emoji` class to Activity Vocabulary API.  [[#48]]

 -  Added an actor handle normalization function.

     -  Added `normalizeActorHandle()` function.
     -  Added `NormalizeActorHandleOptions` interface.
     -  The `getActorHandle()` function now guarantees that the returned
        actor handle is normalized.
     -  Added the second optional parameter to `getActorHandle()` function.
     -  The return type of `getActorHandle()` function became
        ``Promise<`@${string}@${string}` | `${string}@${string}`>``
        (was ``Promise<`@${string}@${string}`>``).

 -  Added `excludeBaseUris` option to `Context.sendActivity()` and
    `Federation.sendActivity()` methods.

     -  Added `SendActivityOptions.excludeBaseUris` property.
     -  Added `ExtractInboxesParameters.excludeBaseUris` property.

 -  The `Context` now can parse URIs of objects, inboxes, and collections as
    well as actors.

     -  Added `Context.parseUri()` method.
     -  Added `ParseUriResult` type.
     -  Deprecated `Context.getHandleFromActorUri()` method.

 -  The time window for signature verification is now configurable.  [[#52]]

     -  The default time window for signature verification is now a minute (was
        30 seconds).
     -  Added `signatureTimeWindow` option to `FederationParameters` interface.
     -  Added `VerifyOptions` interface.
     -  The signature of the `verify()` function is revamped; it now optionally
        takes a `VerifyOptions` object as the second parameter.

 -  Renamed the `@fedify/fedify/httpsig` module to `@fedify/fedify/sig`, and
    also:

     -  Deprecated `sign()` function.  Use `signRequest()` instead.
     -  Deprecated `verify()` function.  Use `verifyRequest()` instead.
     -  Deprecated `VerifyOptions` interface.  Use `VerifyRequestOptions`
        instead.

 -  When signing an HTTP request, the `algorithm` parameter is now added to
    the `Signature` header.  This change improves the compatibility with
    Misskey and other implementations that require the `algorithm` parameter.

 -  Added more log messages using the [LogTape] library.  Currently the below
    logger categories are used:

     -  `["fedify", "federation", "actor"]`
     -  `["fedify", "federation", "http"]`
     -  `["fedify", "sig", "http"]`
     -  `["fedify", "sig", "key"]`
     -  `["fedify", "sig", "owner"]`

[#48]: https://github.com/dahlia/fedify/issues/48
[#52]: https://github.com/dahlia/fedify/issues/52


Version 0.8.0
-------------

Released on May 6, 2024.

 -  The CLI toolchain for testing and debugging is now available on JSR:
    [@fedify/cli].  You can install it with
    `deno install -A --unstable-fs --unstable-kv --unstable-temporal -n fedify
    jsr:@fedify/cli`, or download a standalone executable from the [releases]
    page.

     -  Added `fedify` command.
     -  Added `fedify lookup` subcommand.
     -  Added `fedify inbox` subcommand.

 -  Implemented [followers collection synchronization mechanism][FEP-8fcf].

     -  Added `RequestContext.sendActivity()` overload that takes `"followers"`
        as the second parameter.
     -  Added the second type parameter to `CollectionCallbackSetters`
        interface.
     -  Added the second type parameter to `CollectionDispatcher` type.
     -  Added the fourth parameter to `CollectionDispatcher` type.
     -  Added the second type parameter to `CollectionCounter` type.
     -  Added the third parameter to `CollectionCounter` type.
     -  Added the second type parameter to `CollectionCursor` type.
     -  Added the third parameter to `CollectionCursor` type.

 -  Relaxed the required type for activity recipients.

     -  Added `Recipient` interface.
     -  The type of the second parameter of `Context.sendActivity()` method
        became `Recipient | Recipient[]` (was `Actor | Actor[]`).  However,
        since `Recipient` is a supertype of `Actor`, the existing code should
        work without any change.

 -  Followers collection now has to consist of `Recipient` objects only.
    (It could consist of `URL`s as well as `Actor`s before.)

     -  The type of `Federation.setFollowersDispatcher()` method's second
        parameter became `CollectionDispatcher<Recipient, TContextData, URL>`
        (was `CollectionDispatcher<Actor | URL, TContextData>`).

 -  Some of the responsibility of a document loader was separated to a context
    loader and a document loader.

     -  Added `contextLoader` option to constructors, `fromJsonLd()` static
        methods, `clone()` methods, and all non-scalar accessors (`get*()`) of
        Activity Vocabulary classes.
     -  Renamed `documentLoader` option to `contextLoader` in `toJsonLd()`
        methods of Activity Vocabulary objects.
     -  Added `contextLoader` option to `LookupObjectOptions` interface.
     -  Added `contextLoader` property to `Context` interface.
     -  Added `contextLoader` option to `FederationParameters` interface.
     -  Renamed `documentLoader` option to `contextLoader` in
        `RespondWithObjectOptions` interface.
     -  Added `GetKeyOwnerOptions` interface.
     -  The type of the second parameter of `getKeyOwner()` function became
        `GetKeyOwnerOptions` (was `DocumentLoader`).
     -  Added `DoesActorOwnKeyOptions` interface.
     -  The type of the third parameter of `doesActorOwnKey()` function became
        `DoesActorOwnKeyOptions` (was `DocumentLoader`).

 -  Added `width` and `height` properties to `Document` class for better
    compatibility with Mastodon.  [[#47]]

     -  Added `Document.width` property.
     -  Added `Document.height` property.
     -  `new Document()` constructor now accepts `width` option.
     -  `new Document()` constructor now accepts `height` option.
     -  `Document.clone()` method now accepts `width` option.
     -  `Document.clone()` method now accepts `height` option.

 -  Removed the dependency on *@js-temporal/polyfill* on Deno, and Fedify now
    requires `--unstable-temporal` flag.  On other runtime, it still depends
    on *@js-temporal/polyfill*.

 -  Added more log messages using the [LogTape] library.  Currently the below
    logger categories are used:

     -  `["fedify", "federation", "collection"]`
     -  `["fedify", "httpsig", "verify"]`
     -  `["fedify", "runtime", "docloader"]`

 -  Fixed a bug where the authenticated document loader had thrown `InvalidUrl`
    error when the URL redirection was involved in Bun.

 -  Fixed a bug of `lookupObject()` that it had failed to look up the actor
    object when WebFinger response had no links with
    `"type": "application/activity+json"` but had `"type":
    "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\""`.

[@fedify/cli]: https://jsr.io/@fedify/cli
[releases]: https://github.com/dahlia/fedify/releases
[FEP-8fcf]: https://codeberg.org/fediverse/fep/src/branch/main/fep/8fcf/fep-8fcf.md
[#47]: https://github.com/dahlia/fedify/issues/47


Version 0.7.0
-------------

Released on April 23, 2024.

 -  Added `PUBLIC_COLLECTION` constant for [public addressing].

 -  `Federation` now supports [authorized fetch] for actor dispatcher and
    collection dispatchers.

     -  Added `ActorCallbackSetters.authorize()` method.
     -  Added `CollectionCallbackSetters.authorize()` method.
     -  Added `AuthorizedPredicate` type.
     -  Added `RequestContext.getSignedKey()` method.
     -  Added `RequestContext.getSignedKeyOwner()` method.
     -  Added `FederationFetchOptions.onUnauthorized` option for handling
        unauthorized fetches.
     -  Added `getKeyOwner()` function.

 -  The default implementation of `FederationFetchOptions.onNotAcceptable`
    option now responds with `Vary: Accept, Signature` header.

 -  Added log messages using the [LogTape] library.  Currently the below
    logger categories are used:

     -  `["fedify"]`
     -  `["fedify", "federation"]`
     -  `["fedify", "federation", "inbox"]`
     -  `["fedify", "federation", "outbox"]`

 -  Added `RequestContext.getActor()` method.

 -  Activity Vocabulary classes now have `typeId` static property.

 -  Dispatcher setters and inbox listener setters in `Federation` now take
    a path as `` `${string}{handle}${string}` `` instead of `string`
    so that it is more type-safe.

 -  Added generalized object dispatchers.  [[#33]]

     -  Added `Federation.setObjectDispatcher()` method.
     -  Added `ObjectDispatcher` type.
     -  Added `ObjectAuthorizePredicate` type.
     -  Added `Context.getObjectUri()` method.
     -  Added `RequestContext.getObject()` method.

[public addressing]: https://www.w3.org/TR/activitypub/#public-addressing
[authorized fetch]: https://swicg.github.io/activitypub-http-signature/#authorized-fetch
[LogTape]: https://github.com/dahlia/logtape
[#33]: https://github.com/dahlia/fedify/issues/33


Version 0.6.1
-------------

Released on April 17, 2024.

 -  Fixed a bug of `new Federation()` constructor that if it is once called
    the process will never exit.  [[#39]]


Version 0.6.0
-------------

Released on April 9, 2024.

 -  `DocumentLoader` is now propagated to the loaded remote objects from
    Activity Vocabulary objects.  [[#27]]

     -  Added `options` parameter to Activity Vocabulary constructors.
     -  Added `options` parameter to `clone()` method of Activity Vocabulary
        objects.
     -  The Activity Vocabulary object passed to `InboxListener` now implicitly
        loads remote object with an authenticated `DocumentLoader`.

 -  Added `Federation.fetch()` method.

     -  Deprecated `Federation.handle()` method.  Use `Federation.fetch()`
        method instead.
     -  Renamed `FederationHandlerParameters` type to `FederationFetchOptions`.
     -  Added `integrateFetchOptions()` function.
     -  Deprecated `integrateHandlerOptions()` function.

 -  Added `@fedify/fedify/x/hono` module for integrating with [Hono] middleware.
    [[#25]]

     -  Added `federation()` function.
     -  Added `ContextDataFactory` type.

 -  `Context.sendActivity()` method now throws `TypeError` instead of silently
    failing when the given `Activity` object lacks the actor property.

 -  `Context.sendActivity()` method now uses an authenticated document
    loader under the hood.

 -  Added outbox error handler to `Federation`.

     -  Added `onOutboxError` option to `new Federation()` constructor.
     -  Added `OutboxErrorHandler` type.

[Hono]: https://hono.dev/
[#25]: https://github.com/dahlia/fedify/issues/25
[#27]: https://github.com/dahlia/fedify/issues/27


Version 0.5.2
-------------

Released on April 17, 2024.

 -  Fixed a bug of `new Federation()` constructor that if it is once called
    the process will never exit.  [[#39]]

[#39]: https://github.com/dahlia/fedify/issues/39


Version 0.5.1
-------------

Released on April 5, 2024.

 -  Fixed a bug of `Federation` that its actor/collection dispatchers had done
    content negotiation before determining if the resource exists or not.
    It also fixed a bug that `integrateHandler()` from `@fedify/fedify/x/fresh`
    had responded with `406 Not Acceptable` instead of `404 Not Found` when
    the resource does not exist in the web browser.  [[#34]]

[#34]: https://github.com/dahlia/fedify/issues/34


Version 0.5.0
-------------

Released on April 2, 2024.

 -  Fedify is now available on npm: [@fedify/fedify].  [[#24]]

 -  Abstract key-value store for caching.

     -  Added `KvStore` interface.
     -  Added `KvStoreSetOptions` interface.
     -  Added `KvKey` type.
     -  Added `DenoKvStore` class.
     -  `KvCacheParameters.kv` option now accepts a `KvStore` instead of
        `Deno.Kv`.
     -  `KvCacheParameters.prefix` option now accepts a `KvKey` instead of
        `Deno.KvKey`.
     -  `FederationParameters.kv` option now accepts a `KvStore` instead of
        `Deno.Kv`.
     -  `FederationKvPrefixes.activityIdempotence` option now accepts a `KvKey`
        instead of `Deno.KvKey`.
     -  `FederationKvPrefixes.remoteDocument` option now accepts a `KvKey`
        instead of `Deno.KvKey`.

 -  Abstract message queue for outgoing activities.

     -  Added `MessageQueue` interface.
     -  Added `MessageQueueEnqueueOptions` interface.
     -  Added `InProcessMessageQueue` class.
     -  Added `FederationParameters.queue` option.

 -  Added `@fedify/fedify/x/denokv` module for adapting `Deno.Kv` to `KvStore`
    and `MessageQueue`.  It is only available in Deno runtime.

     -  Added `DenoKvStore` class.
     -  Added `DenoKvMessageQueue` class.

 -  Added `PropertyValue` to Activity Vocabulary API.  [[#29]]

     -  Added `PropertyValue` class.
     -  `new Object()` constructor's `attachments` option now accepts
        `PropertyValue` objects.
     -  `new Object()` constructor's `attachment` option now accepts
        a `PropertyValue` object.
     -  `Object.getAttachments()` method now yields `PropertyValue` objects
        besides `Object` and `Link` objects.
     -  `Object.getAttachment()` method now returns a `PropertyValue` object
        besides an `Object` and a `Link` object.
     -  `Object.clone()` method's `attachments` option now accepts
        `PropertyValue` objects.
     -  `Object.clone()` method's `attachment` option now accepts
        a `PropertyValue` object.

 -  Removed dependency on *jose*.

     -  Added `exportSpki()` function.
     -  Added `importSpki()` function.

 -  Fixed a bug that `Application.manuallyApprovesFollowers`,
    `Group.manuallyApprovesFollowers`, `Organization.manuallyApprovesFollowers`,
    `Person.manuallyApprovesFollowers`, and `Service.manuallyApprovesFollowers`
    properties were not properly displayed in Mastodon.

[@fedify/fedify]: https://www.npmjs.com/package/@fedify/fedify
[#24]: https://github.com/dahlia/fedify/discussions/24
[#29]: https://github.com/dahlia/fedify/issues/29


Version 0.4.0
-------------

Released on March 26, 2024.

 -  Added `@fedify/fedify/x/fresh` module for integrating with [Fresh]
    middleware.

     -  Added `integrateHandler()` function.
     -  Added `integrateHandlerOptions()` function.

 -  Added `getActorHandle()` function.

 -  Fedify now has authenticated document loader.  [[#12]]

     -  Added `Context.getDocumentLoader()` method.
     -  Added `getAuthenticatedDocumentLoader()` function.
     -  Added `AuthenticatedDocumentLoaderFactory` type.
     -  Added `authenticatedDocumentLoaderFactory` option to `new Federation()`
        constructor.
     -  `Context.documentLoader` property now returns an authenticated document
        loader in personal inbox listeners.  (Note that it's not affected in
        shared inbox listeners.)

 -  Added singular accessors to `Object`'s `icon` and `image` properties.

     -  `new Object()` constructor now accepts `icon` option.
     -  `new Object()` constructor now accepts `image` option.
     -  Added `Object.getIcon()` method.
     -  Added `Object.getImage()` method.
     -  `Object.clone()` method now accepts `icon` option.
     -  `Object.clone()` method now accepts `image` option.

 -  `Object`'s `icon` and `image` properties no more accept `Link` objects.

     -  `new Object()` constructor's `icons` option no more accepts `Link`
        objects.
     -  `new Object()` constructor's `images` option no more accepts `Link`
        objects.
     -  `Object.getIcons()` method no more yields `Link` objects.
     -  `Object.getImages()` method no more yields `Link` objects.
     -  `Object.clone()` method's `icons` option no more accepts `Link` objects.
     -  `Object.clone()` method's `images` option no more accepts `Link`
        objects.

 -  `Object`'s `attributedTo` property was renamed to `attribution`.

    -  `new Object()` constructor's `attributedTo` option was renamed to
       `attribution`.
    -  `new Object()` constructor's `attributedTos` option was renamed to
       `attributions`.
    -  `Object.getAttributedTo()` method is renamed to
       `Object.getAttribution()`.
    -  `Object.getAttributedTos()` method is renamed to
       `Object.getAttributions()`.
    -  `Object.clone()` method's `attributedTo` option is renamed to
       `attribution`.
    -  `Object.clone()` method's `attributedTos` option is renamed to
       `attributions`.

 -  `Object`'s `attribution` property (was `attributedTo`) now accepts only
    `Actor` objects.

     -  `new Object()` constructor's `attribution` option (was `attributedTo`)
        now accepts only an `Actor` object.
     -  `new Object()` constructor's `attributions` option (was `attributedTos`)
        now accepts only `Actor` objects.
     -  `Object.getAttribution()` method (was `getAttributedTo()`) now returns
        only an `Actor` object.
     -  `Object.getAttributions()` method (was `getAttributedTos()`) now returns
        only `Actor` objects.
     -  `Object.clone()` method's `attribution` option (`attributedTo`) now
        accepts only an `Actor` object.
     -  `Object.clone()` method's `attributions` option (`attributedTos`) now
        accepts only `Actor` objects.

 -  `Activity`'s `object` property no more accepts `Link` objects.

     -  `new Activity()` constructor's `object` option no more accepts a `Link`
        object.
     -  `new Activity()` constructor's `objects` option no more accepts `Link`
        objects.
     -  `Activity.getObject()` method no more returns a `Link` object.
     -  `Activity.getObjects()` method no more returns `Link` objects.
     -  `Activity.clone()` method's `object` option no more accepts a `Link`
        object.
     -  `Activity.clone()` method's `objects` option no more accepts `Link`
        objects.

 -  `Activity`'s `actor` property now accepts only `Actor` objects.

     -  `new Activity()` constructor's `actor` option now accepts only
        an `Actor` object.
     -  `new Activity()` constructor's `actors` option now accepts only `Actor`
        objects.
     -  `Activity.getActor()` method now returns only an `Actor` object.
     -  `Activity.getActors()` method now returns only `Actor` objects.
     -  `Activity.clone()` method's `actor` option now accepts only an `Actor`
        object.
     -  `Activity.clone()` method's `actors` option now accepts only `Actor`
        objects.

 -  Added `sensitive` property to `Object` class.

     -  `new Object()` constructor now accepts `sensitive` option.
     -  Added `Object.sensitive` attribute.
     -  `Object.clone()` method now accepts `sensitive` option.

 -  Now `lookupWebFinger()` follows redirections.

 -  The `http://webfinger.net/rel/profile-page` links in WebFinger responses
    now omit `type` property.

[Fresh]: https://fresh.deno.dev/
[#12]: https://github.com/dahlia/fedify/issues/12


Version 0.3.0
-------------

Released on March 15, 2024.

 -  Added utility functions for responding with an ActivityPub object:

     -  Added `respondWithObject()` function.
     -  Added `respondWithObjectIfAcceptable()` function.
     -  Added `RespondWithObjectOptions` interface.

 -  Added utility functions for generating and exporting cryptographic keys
    which are compatible with popular ActivityPub software:

     -  Added `generateCryptoKeyPair()` function.
     -  Added `exportJwk()` function.
     -  Added `importJwk()` function.

 -  The following functions and methods now throw `TypeError` if the specified
    `CryptoKey` is not `extractable`:

     -  `Context.getActorKey()` method
     -  `Context.sendActivity()` method
     -  `Federation.sendActivity()` method

 -  Added `immediate` option to `Context.sendActivity()` and
    `Federation.sendActivity()` methods.

 -  Added `SendActivityOptions` interface.

 -  Now `onNotFound`/`onNotAcceptable` options are optional for
    `Federation.handle()` method.  [[#9]]

[#9]: https://github.com/dahlia/fedify/issues/9


Version 0.2.0
-------------

Released on March 10, 2024.

 -  Implemented [NodeInfo] 2.1 protocol.  [[#1]]

     -  Now `Federation.handle()` accepts requests for */.well-known/nodeinfo*.
     -  Added `Federation.setNodeInfoDispatcher()` method.
     -  Added `Context.getNodeInfoUri()` method.
     -  Added `NodeInfo` interface.
     -  Added `Software` interface.
     -  Added `Protocol` type.
     -  Added `Services` interface.
     -  Added `InboundService` type.
     -  Added `OutboundService` type.
     -  Added `Usage` interface.
     -  Added `NodeInfoDispatcher` type.
     -  Added `nodeInfoToJson()` function.

 -  Implemented [WebFinger] client.

     -  Added `lookupObject()` function.
     -  Added `lookupWebFinger()` function.

 -  `Federation.handle()` now responds with `Access-Control-Allow-Origin: *`
    header for WebFinger requests.

 -  `fetchDocumentLoader()`, the default document loader, now sends `Accept:
    application/activity+json, application/ld+json` header (was `Accept:
    application/ld+json` only).

[NodeInfo]: https://nodeinfo.diaspora.software/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[#1]: https://github.com/dahlia/fedify/issues/1


Version 0.1.0
-------------

Initial release.  Released on March 8, 2024.
