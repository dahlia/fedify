---
description: >-
  Testing a federated server app is a bit tricky because it requires a
  federated environment.  This document explains how to easily test your
  federated server app with the help of several tools.
prev:
  text: Integration
  link: ./integration.md
next: false
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
> you can use the [`treatHttps` option](./federation.md#treathttps) in
> the `new Federation()` constructor to force the federation server to generate
> HTTPS URLs:
>
> ~~~~ typescript
> import { Federation } from "@fedify/fedify";
>
> const federation = new Federation({
>   // ...
>   treatHttps: true,   // [!code highlight]
> });
> ~~~~


[^1]: According to the [*Object Identifiers* section][1] in the ActivityPub
      specification, the public dereferenceable URIs should use HTTPS URIs.

[1]: https://www.w3.org/TR/activitypub/#obj-id

<!-- cSpell: ignore serveo tailscale -->


Inspecting ActivityPub messages
-------------------------------

[ActivityPub.Academy] is a special Mastodon instance that is designed for
debugging and testing ActivityPub peers.  You can create an account on it and
use it for testing your federated server app.  Its best feature is that it
provides a web interface for debugging ActivityPub messages.  Any sent and
received activities are displayed on the web interface in real-time.

> [!NOTE]
> Any accounts on ActivityPub.Academy are volatile; they are deleted after a
> certain period of inactivity.

[ActivityPub.Academy]: https://activitypub.academy/
