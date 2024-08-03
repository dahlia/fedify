---
description: >-
  Testing a federated server app is a bit tricky because it requires a
  federated environment.  This document explains how to easily test your
  federated server app with the help of several tools.
prev:
  text: Integration
  link: ./integration.md
next:
  text: Logging
  link: ./log.md
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


Inspecting ActivityPub messages
-------------------------------

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
