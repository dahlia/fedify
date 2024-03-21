---
title: Changelog
doc_title: Fedify changelog
nav_order: 9
---
<!-- deno-fmt-ignore-file -->

Fedify changelog
================

Version 0.4.0
-------------

To be released.

 -  Added `@fedify/fedify/x/fresh` module for integrating with [Fresh]
    middleware.

     -  Added `integrateHandler()` function.
     -  Added `integrateHandlerOptions()` function.

 -  Added `getActorHandle()` function.

 -  Fedify now has authenticated document loader.  [[#12]]

     -  Added `Context.getDocumentLoader()` method.
     -  Added `getAuthenticatedDocumentLoader()` function.

 -  Now `lookupWebFinger()` follows redirections.

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
