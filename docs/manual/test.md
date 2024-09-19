---
description: >-
  Testing a federated server app is a bit tricky because it requires a
  federated environment.  This document explains how to easily test your
  federated server app with the help of several tools.
---

Testing
=======

Testing a federated server app is a bit tricky because it requires a federated
environment.  This document explains how to easily test your federated server
app with the help of several tools.


Exposing a local server to the public
-------------------------------------

To test your federated server app, you need to expose your local server to the
public internet with a domain name and TLS certificate.  There are several tools
that help you do that:

 -  [`fedify tunnel`](../cli.md#fedify-tunnel-exposing-a-local-http-server-to-the-public-internet)
 -  [ngrok](https://ngrok.com/)
 -  [serveo](https://serveo.net/)
 -  [localhost.run](https://localhost.run/)
 -  [Tailscale Funnel](https://tailscale.com/kb/1223/funnel)

> [!NOTE]
> These tools are not for production use; they are for testing only.
> In production, you should expose your server with a proper domain and TLS
> certificate.

> [!TIP]
> These tools behave like a reverse proxy, so basically the federation server
> cannot recognize if it is behind a reverse proxy, and if the reverse proxy
> is in HTTPS.  So the federation server will generate HTTP URLs in the
> ActivityPub messages, which cause interoperability issues.[^1]  In this case,
> you can use the [x-forwarded-fetch] middleware in front of
> the `Federation.fetch()` method so that the `Federation` object recognizes
> the proper domain name and protocol of the incoming HTTP requests.
>
> For more information, see [*How the <code>Federation</code> object recognizes
> the domain name* section](./federation.md#how-the-federation-object-recognizes-the-domain-name)
> in the *Federation* document.

[^1]: According to the [*Object Identifiers* section][1] in the ActivityPub
      specification, the public dereferenceable URIs should use HTTPS URIs.

[x-forwarded-fetch]: https://github.com/dahlia/x-forwarded-fetch
[1]: https://www.w3.org/TR/activitypub/#obj-id

<!-- cSpell: ignore serveo tailscale -->


Inspecting ActivityPub objects
------------------------------

### BrowserPub

[BrowserPub] is a browser for debugging ActivityPub and the fediverse.  You can
punch in any ActivityPub discoverable web URL or fediverse handle, and it will
discover and display the underlying ActivityPub.

For example:

 -  [hollo.social/@fedify](https://browser.pub/https://hollo.social/@fedify)
 -  [@hongminhee@fosstodon.org](https://browser.pub/@hongminhee@fosstodon.org)

If you want to know further details about BrowserPub,
read the [creator's Mastodon thread].

[BrowserPub]: https://browser.pub/
[creator's Mastodon thread]: https://podcastindex.social/@js/113011966366461060

### `fedify lookup` command

Fedify provides a [CLI toolchain](../cli.md) for testing and debugging.
The [`fedify
lookup` command](../cli.md#fedify-lookup-looking-up-an-activitypub-object)
is a simple tool for looking up an ActivityPub object by its URL or fediverse
handle.


Inspecting ActivityPub activities
---------------------------------

### ActivityPub.Academy

[ActivityPub.Academy] is a special Mastodon instance that is designed for
debugging and testing ActivityPub peers.  You can create an account on it and
use it for testing your federated server app.  Its best feature is that it
provides a web interface for debugging ActivityPub messages.  Any sent and
received activities are displayed on the web interface in real-time.

> [!NOTE]
> Any accounts on ActivityPub.Academy are volatile; they are deleted after a
> certain period of inactivity.

[ActivityPub.Academy]: https://activitypub.academy/

### `fedify inbox` command

Fedify provides a [CLI toolchain](../cli.md) for testing and debugging.
The [`fedify inbox` command](../cli.md#fedify-inbox-ephemeral-inbox-server) is
a simple tool for spinning up an ephemeral inbox server that receives and
displays incoming ActivityPub messages.


Allowing fetching private network addresses
-------------------------------------------

*This API is available since Fedify 0.15.0.*

By default, Fedify disallows fetching private network addresses
(e.g., localhost) in order to prevent [SSRF] attacks.  However, in some cases,
you may want to allow fetching private network addresses for testing purposes
(e.g., end-to-end testing).  In this case, you can set
the [`allowPrivateAddress`](./federation.md#allowprivateaddress) option to
`true` in the `createFederation()` function:

~~~~ typescript twoslash
// @noErrors: 2345
import { createFederation } from "@fedify/fedify";
// ---cut-before---
const federation = createFederation({
  // ... other options
  allowPrivateAddress: true,
});
~~~~

> [!NOTE]
> By turning on the `allowPrivateAddress` option, you cannot configure other
> options related to document loaders including
> [`documentLoader`](./federation.md#documentloader),
> [`contextLoader`](./federation.md#contextloader), and
> [`authenticatedDocumentLoaderFactory`](./federation.md#authenticateddocumentloaderfactory)

> [!WARNING]
> Be careful when you allow fetching private network addresses.  It may cause
> security vulnerabilities such as [SSRF].  Make sure to turn off the option
> when you finish testing, or conditionally turn it on only in the testing
> environment.

[SSRF]: https://owasp.org/www-community/attacks/Server_Side_Request_Forgery
