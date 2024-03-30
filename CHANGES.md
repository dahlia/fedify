---
title: Changelog
doc_title: Fedify changelog
nav_order: 9
---
<!-- deno-fmt-ignore-file -->

Fedify changelog
================

Version 0.5.0
-------------

To be released.

 -  Removed dependency on *jose*.

     -  Added `exportSpki()` function.
     -  Added `importSpki()` function.


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
