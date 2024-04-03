---
layout: home

hero:
  name: Fedify
  text: ActivityPub server framework
  tagline: >-
    A Deno/TypeScript library for building federated server apps
    powered by ActivityPub and other standards, so-called fediverse
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
    link: /tutorial.md
  - theme: alt
    text: GitHub
    link: https://github.com/dahlia/fedify

features:
- icon: 🕸️
  title: ActivityPub
  details: >-
    <a href="https://www.w3.org/TR/activitypub/">ActivityPub</a> server and
    client
- icon: 📚
  title: Vocabulary
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
- icon: ✉️
  title: HTTPS Signatures
  details: >-
    Signing and verifying <a
    href="https://tools.ietf.org/html/draft-cavage-http-signatures-12">HTTP
    Signatures</a>
- icon: ℹ️
  title: NodeInfo
  details: >-
    <a href="https://nodeinfo.diaspora.software/">NodeInfo</a> server
  link: /manual/nodeinfo.md
- icon: 🤝
  title: Interoparability
  details: >-
    Special touch for interoperability with Mastodon and few other popular
    fediverse software
  link: /manual/pragmatics.md
---
