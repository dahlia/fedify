<!-- deno-fmt-ignore-file -->

Federation
==========

Supported federation protocols and standards
--------------------------------------------

 -  [ActivityPub] (S2S)
 -  [WebFinger]
 -  [HTTP Signatures]
 -  [NodeInfo]

[ActivityPub]: https://www.w3.org/TR/activitypub/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[HTTP Signatures]: https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures
[NodeInfo]: https://nodeinfo.diaspora.software/


Supported FEPs
--------------

 -  [FEP-67ff][]: FEDERATION.md
 -  [FEP-8fcf][]: Followers collection synchronization across servers
 -  [FEP-f1d5][]: NodeInfo in Fediverse Software
 -  [FEP-8b32][]: Object Integrity Proofs
 -  [FEP-521a][]: Representing actor's public keys
 -  [FEP-5feb][]: Search indexing consent for actors
 -  [FEP-c7d3][]: Ownership

[FEP-67ff]: https://codeberg.org/fediverse/fep/src/branch/main/fep/67ff/fep-67ff.md
[FEP-8fcf]: https://codeberg.org/fediverse/fep/src/branch/main/fep/8fcf/fep-8fcf.md
[FEP-f1d5]: https://codeberg.org/fediverse/fep/src/branch/main/fep/f1d5/fep-f1d5.md
[FEP-8b32]: https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md
[FEP-521a]: https://codeberg.org/fediverse/fep/src/branch/main/fep/521a/fep-521a.md
[FEP-5feb]: https://codeberg.org/fediverse/fep/src/branch/main/fep/5feb/fep-5feb.md
[FEP-c7d3]: https://codeberg.org/silverpill/feps/src/branch/main/c7d3/fep-c7d3.md


ActivityPub
-----------

Since Fedify is a framework, what activity types it uses is up to
the application developers.  However, Fedify provides a set of
activity types that are commonly used in the fediverse.  The following
lists the activity types that Fedify provides:

 -  [`Accept`](https://jsr.io/@fedify/fedify/doc/vocab/~/Accept)
 -  [`Add`](https://jsr.io/@fedify/fedify/doc/vocab/~/Add)
 -  [`Announce`](https://jsr.io/@fedify/fedify/doc/vocab/~/Announce)
 -  [`Arrive`](https://jsr.io/@fedify/fedify/doc/vocab/~/Arrive)
 -  [`Block`](https://jsr.io/@fedify/fedify/doc/vocab/~/Block)
 -  [`ChatMessage`](https://jsr.io/@fedify/fedify/doc/vocab/~/ChatMessage)
 -  [`Create`](https://jsr.io/@fedify/fedify/doc/vocab/~/Create)
 -  [`Delete`](https://jsr.io/@fedify/fedify/doc/vocab/~/Delete)
 -  [`Dislike`](https://jsr.io/@fedify/fedify/doc/vocab/~/Dislike)
 -  [`Flag`](https://jsr.io/@fedify/fedify/doc/vocab/~/Flag)
 -  [`Follow`](https://jsr.io/@fedify/fedify/doc/vocab/~/Follow)
 -  [`Ignore`](https://jsr.io/@fedify/fedify/doc/vocab/~/Ignore)
 -  [`Invite`](https://jsr.io/@fedify/fedify/doc/vocab/~/Invite)
 -  [`Join`](https://jsr.io/@fedify/fedify/doc/vocab/~/Join)
 -  [`Leave`](https://jsr.io/@fedify/fedify/doc/vocab/~/Leave)
 -  [`Like`](https://jsr.io/@fedify/fedify/doc/vocab/~/Like)
 -  [`Listen`](https://jsr.io/@fedify/fedify/doc/vocab/~/Listen)
 -  [`Move`](https://jsr.io/@fedify/fedify/doc/vocab/~/Move)
 -  [`Offer`](https://jsr.io/@fedify/fedify/doc/vocab/~/Offer)
 -  [`Question`](https://jsr.io/@fedify/fedify/doc/vocab/~/Question)
 -  [`Read`](https://jsr.io/@fedify/fedify/doc/vocab/~/Read)
 -  [`Reject`](https://jsr.io/@fedify/fedify/doc/vocab/~/Reject)
 -  [`Remove`](https://jsr.io/@fedify/fedify/doc/vocab/~/Remove)
 -  [`TentativeAccept`](https://jsr.io/@fedify/fedify/doc/vocab/~/TentativeAccept)
 -  [`TentativeReject`](https://jsr.io/@fedify/fedify/doc/vocab/~/TentativeReject)
 -  [`Travel`](https://jsr.io/@fedify/fedify/doc/vocab/~/Travel)
 -  [`Undo`](https://jsr.io/@fedify/fedify/doc/vocab/~/Undo)
 -  [`Update`](https://jsr.io/@fedify/fedify/doc/vocab/~/Update)
 -  [`View`](https://jsr.io/@fedify/fedify/doc/vocab/~/View)
