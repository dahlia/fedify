<!-- deno-fmt-ignore-file -->

Federation
==========

Supported federation protocols and standards
--------------------------------------------

 -  [ActivityPub] (S2S)
 -  [WebFinger]
 -  [HTTP Signatures]
 -  [Linked Data Signatures]
 -  [NodeInfo]

[ActivityPub]: https://www.w3.org/TR/activitypub/
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033
[HTTP Signatures]: https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures
[Linked Data Signatures]: https://web.archive.org/web/20170923124140/https://w3c-dvcg.github.io/ld-signatures/
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
 -  [FEP-c0e0][]: Emoji reactions

[FEP-67ff]: https://w3id.org/fep/67ff
[FEP-8fcf]: https://w3id.org/fep/8fcf
[FEP-f1d5]: https://w3id.org/fep/f1d5
[FEP-8b32]: https://w3id.org/fep/8b32
[FEP-521a]: https://w3id.org/fep/521a
[FEP-5feb]: https://w3id.org/fep/5feb
[FEP-c7d3]: https://w3id.org/fep/c7d3
[FEP-c0e0]: https://w3id.org/fep/c0e0


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
 -  [`EmojiReact`](https://jsr.io/@fedify/fedify/doc/vocab/~/EmojiReact)
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
