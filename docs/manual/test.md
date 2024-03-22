---
parent: Manual
nav_order: 8
metas:
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

 -  [ngrok](https://ngrok.com/)
 -  [serveo](https://serveo.net/)
 -  [localhost.run](https://localhost.run/)

> [!NOTE]
> These tools are not for production use; they are for testing only.
> In production, you should expose your server with a proper domain and TLS
> certificate.

<!-- cSpell: ignore serveo -->


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
