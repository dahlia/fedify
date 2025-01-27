---
layout: home
description: >-
  Fedify is a TypeScript library for building federated server apps powered by
  ActivityPub and other standards, so-called fediverse.

hero:
  name: Fedify
  text: ActivityPub server framework
  tagline: >-
    A TypeScript library for building federated server apps
    powered by <a style="border-bottom: 2px solid;"
    href="https://activitypub.rocks/">ActivityPub</a> and other standards,
    so-called <a style="border-bottom: 2px solid;"
    href="https://www.theverge.com/24063290/fediverse-explained-activitypub-social-media-open-protocol"
    >fediverse</a>
  image: /logo.png
  actions:
  - theme: brand
    text: What is Fedify?
    link: /intro.md
  - theme: alt
    text: Quick demo
    link: https://dash.deno.com/playground/fedify-demo
  - theme: alt
    text: Tutorial
    link: /tutorial/basics.md
  - theme: alt
    text: GitHub
    link: https://github.com/fedify-dev/fedify

features:
- icon: 🕸️
  title: ActivityPub
  details: >-
    <a href="https://www.w3.org/TR/activitypub/">ActivityPub</a> server and
    client
- icon: 📚
  title: Activity Vocabulary
  details: >-
    Type-safe objects for <a
    href="https://www.w3.org/TR/activitystreams-vocabulary/">Activity
    Vocabulary</a> (including some vendor-specific extensions)
  link: /manual/vocab.md
- icon: 👉
  title: WebFinger
  details: >-
    <a href="https://datatracker.ietf.org/doc/html/rfc7033">WebFinger</a>
    client and server
- icon: ✍️
  title: HTTPS Signatures
  details: >-
    Signing and verifying <a
    href="https://tools.ietf.org/html/draft-cavage-http-signatures-12">HTTP
    Signatures</a>
  link: /manual/send.md#http-signatures
- icon: 🔗
  title: Linked Data Signatures
  details: >-
    Creating and verifying <a
    href="https://web.archive.org/web/20170923124140/https://w3c-dvcg.github.io/ld-signatures/">Linked
    Data Signatures</a>
  link: /manual/send.md#linked-data-signatures
- icon: 🪪
  title: Object Integrity Proofs (FEP-8b32)
  details: >-
    Creating and verifying <a href="https://w3id.org/fep/8b32">Object Integrity
    Proofs</a>
  link: /manual/send.md#object-integrity-proofs
- icon: ℹ️
  title: NodeInfo
  details: >-
    <a href="https://nodeinfo.diaspora.software/">NodeInfo</a> server and client
  link: /manual/nodeinfo.md
- icon: 🧩
  title: Integration
  details: Integration with various web frameworks
  link: /manual/integration.md
---
