---
description: >-
  The Activity Vocabulary is a collection of type-safe objects that represent
  the Activity Vocabulary and the vendor-specific extensions.  This section
  explains the key features of the objects.
prev:
  text: Context
  link: ./context.md
next:
  text: Actor dispatcher
  link: ./actor.md
---

Vocabulary
==========

One of the key features of Fedify library is that it provides a collection of
type-safe objects that represent the Activity Vocabulary and the vendor-specific
extensions.

There are tons of objects in the Activity Vocabulary, and it's not practical to
list all of them here.  Instead, we'll show a few examples of the objects that
are available in the library: `Create`, `Note`, and `Person`.  For the full
list of the objects, please refer to the [API reference].

[API reference]: https://jsr.io/@fedify/fedify/doc


Instantiation
-------------

You can instantiate an object by calling the constructor function with an object
that contains the properties of the object.  The following shows an example of
instantiating a `Create` object:

~~~~ typescript
import { Create, Note } from "@fedify/fedify";

const create = new Create({
  id: new URL("https://example.com/activities/123"),
  actor: new URL("https://example.com/users/alice"),
  object: new Note({
    id: new URL("https://example.com/notes/456"),
    content: "Hello, world!",
    published: Temporal.Instant.from("2024-01-01T00:00:00Z"),
  }),
});
~~~~

Note that every URI is represented as a [`URL`] object.  This is for
distinguishing the URIs from the other strings.

> [!TIP]
> You can instantiate an object from a JSON-LD document by calling the
> `fromJsonLd()` method of the object.  See the [*JSON-LD* section](#json-ld)
> for details.

[`URL`]: https://developer.mozilla.org/en-US/docs/Web/API/URL


Properties
----------

Every object in the Activity Vocabulary has a set of properties.  The properties
are categorized into the following types:

 -  Functional or non-functional
 -  Scalar or non-scalar

<dfn>Functional properties</dfn> are the properties that contain zero or
a single value, while <dfn>non-functional</dfn> properties are the properties
that contain zero or multiple values.

<dfn>Scalar properties</dfn> can contain only [scalar values](#scalar-types)
(e.g., string, number, boolean, URI), while <dfn>non-scalar properties</dfn> 
can contain both scalar and non-scalar values. Objects like `Create`, `Note`,
and `Person` are non-scalar values.  Non-scalar properties can contain either
objects or URIs (object ID) of the objects.

Depending on the category of the property, the accessors of the property are
different.  The following table shows examples of the accessors:

|            | Functional                            | Non-functional                                                                         |
|------------|---------------------------------------|----------------------------------------------------------------------------------------|
| Scalar     | `Object.published`                    | `Object.name`/`~Object.names`                                                          |
| Non-scalar | `Person.inboxId`/`~Person.getInbox()` | `Activity.actorId`/`~Activity.actorIds`/`~Activity.getActor()`/`~Activity.getActors()` |

Some non-functional properties have both singular and plural accessors for
the sake of convenience.  In such cases, the singular accessors return the first
value of the property, while the plural accessors return all values of the
property.


Object IDs and remote objects
-----------------------------

Every object in the Activity Vocabulary has an `id` property, which is the URI
of the object.  It is used to identify and dereference the object.

For example, the following two objects are equivalent (where dereferencing URI
*https://example.com/notes/456* returns the `Note` object):

~~~~ typescript
const a = new Create({
  id: new URL("https://example.com/activities/123"),
  actor: new URL("https://example.com/users/alice"),
  object: new Note({
    id: new URL("https://example.com/notes/456"),
    content: "Hello, world!",
    published: Temporal.Instant.from("2024-01-01T00:00:00Z"),
  }),
});
const b = new Create({
  actor: new URL("https://example.com/users/alice"),
  object: new URL("https://example.com/notes/456"),
});
~~~~

How are the two objects equivalent?  Because for the both objects,
`~Activity.getObject()` returns the equivalent `Note` object.  Such `get*()`
methods for non-scalar properties are called <dfn>dereferencing accessors</dfn>.
Under the hood, the `get*()` methods fetch the remote object from the URI
and return the object if no cache hit.  In the above example, the
`await a.getObject()` immediately returns the `Note` object because it's already
instantiated, while the `await b.getObject()` fetches the remote object from
the URI and returns the `Note` object.

If you only need the object ID without fetching the remote object, you can use
the `*Id`/`*Ids` accessors instead of dereferencing accessors.  In the same
manner, both `a.objectId` and `b.objectId` return the equivalent URI.

> [!TIP]
> Dereferencing accessors take option `documentLoader` to specify the method
> to fetch the remote object.  By default, it uses the default document loader
> which utilizes th  [`fetch()`] API.
> 
> If you want to implement your own document loader, see the `DocumentLoader`
> interface in the API reference.
>
> See the
> [*Getting a `DocumentLoader`* section](./context.md#getting-a-documentloader)
> for details.

[`fetch()`]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API


Immutability
------------

Every object in the Activity Vocabulary is represented as an immutable object.
This means that you cannot change the properties of the object after the object
is instantiated.  This is for ensuring the consistency of the objects and the
safety of the objects in the concurrent environment.

In order to change the properties of the object, you need to clone the object
with the new properties.  Fortunately, the objects have a `clone()` method that
takes an object with the new properties and returns a new object with the new
properties.  The following shows an example of changing the `~Object.content`
property of a `Note` object:

~~~~ typescript{8-10}
import { LanguageString, Note } from "@fedify/fedify";

const noteInEnglish = new Note({
  id: new URL("https://example.com/notes/123"),
  content: new LanguageString("Hello, world!", "en"),
  published: Temporal.Now.instant(),
});
const noteInChinese = noteInEnglish.clone({
  content: new LanguageString("你好，世界！", "zh"),
});
~~~~

Parameters of the `clone()` method share the same type with parameters of
the constructor.


Looking up remote objects
-------------------------

*This API is available since Fedify 0.2.0.*

Suppose your app has a search box that allows the user to look up a fediverse
user by the handle or a post by the URI.  In such cases, you need to look up
the object from a remote server that your app haven't interacted with yet.
The `lookupObject()` function plays a role in such cases.  The following shows
an example of looking up an actor object from the handle:

~~~~ typescript
import { lookupObject } from "@fedify/fedify";

const actor = await lookupObject("@hongminhee@todon.eu");
~~~~

In the above example, the `lookupObject()` function queries the remote server's
WebFinger endpoint to get the actor's URI from the handle, and then fetches the
actor object from the URI.

> [!TIP]
> The `lookupObject()` function accepts a fediverse handle without prefix `@`
> as well:
>
> ~~~~ typescript
> const actor = await lookupObject("hongminhee@todon.eu");
> ~~~~
>
> Also an `acct:` URI:
>
> ~~~~ typescript
> const actor = await lookupObject("acct:hongminhee@todon.eu");
> ~~~~

The `lookupObject()` function is not limited to the actor object.  It can look
up any object in the Activity Vocabulary.  For example, the following shows an
example of looking up a `Note` object from the URI:

~~~~ typescript
const note = await lookupObject("https://todon.eu/@hongminhee/112060633798771581");
~~~~

> [!NOTE]
> Some objects require authentication to look up, such as a `Note` object with
> a visibility of followers-only.  In such cases, you need to use
> the `Context.getDocumentLoader()` method to get an authenticated
> `DocumentLoader` object.  The `lookupObject()` function takes the
> `documentLoader` option to specify the method to fetch the remote object:
>
> ~~~~ typescript
> const documentLoader = await ctx.getDocumentLoader({ handle: "john" });
> const note = await lookupObject("...", { documentLoader });
> ~~~~
>
> See the [*Getting an authenticated
> `DocumentLoader`*](./context.md#getting-an-authenticated-documentloader)
> section for details.


JSON-LD
-------

Under the hood, every object in the Activity Vocabulary is represented as a
[JSON-LD] document.  The JSON-LD document is a JSON object that contains the
properties of the object.  The following shows an example of the JSON-LD
representation of the `Create` object:

~~~~ json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://example.com/activities/123",
  "actor": "https://example.com/users/alice",
  "object": {
    "type": "Note",
    "id": "https://example.com/notes/456",
    "content": "Hello, world!",
    "published": "2024-01-01T00:00:00Z"
  }
}
~~~~

If you want to instantiate an object from a JSON-LD document, you can use the
`fromJsonLd()` method of the object.  The following shows an example of
instantiating a `Create` object from the JSON-LD document:

~~~~ typescript
import { Create } from "@fedify/fedify";

const create = await Create.fromJsonLd({
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://example.com/activities/123",
  "actor": "https://example.com/users/alice",
  "object": {
    "type": "Note",
    "id": "https://example.com/notes/456",
    "content": "Hello, world!",
    "published": "2024-01-01T00:00:00Z"
  }
});
~~~~

Note that the `fromJsonLd()` method can parse a subtype as well.  For example,
since `Create` is a subtype of `Activity`, the `Activity.fromJsonLd()` method
can parse a `Create` object as well:

~~~~ typescript
import { Activity } from "@fedify/fedify";

const create = await Activity.fromJsonLd({
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://example.com/activities/123",
  "actor": "https://example.com/users/alice",
  "object": {
    "type": "Note",
    "id": "https://example.com/notes/456",
    "content": "Hello, world!",
    "published": "2024-01-01T00:00:00Z"
  }
});
~~~~

On the other way around, you can use the `toJsonLd()` method to get the JSON-LD
representation of the object:

~~~~ typescript
const jsonLd = await create.toJsonLd();
~~~~

By default, the `toJsonLd()` method returns the JSON-LD document which is
neither compacted nor expanded.  Instead, it processes the JSON-LD document
without the proper JSON-LD processor for efficiency.

The `toJsonLd()` method takes some options to customize the JSON-LD document.
For example, you can compact the JSON-LD document with a custom context.
In this case, the `toJsonLd()` method returns the compacted JSON-LD document
which is processed by the proper JSON-LD processor:

~~~~ typescript
const jsonLd = await create.toJsonLd({
  format: "compact",
  context: "https://example.com/context",
});
~~~~

> [!TIP]
> Why are the `fromJsonLd()` and `toJsonLd()` methods asynchronous?  Because
> both methods may fetch remote documents under the hood in order to
> [compact/expand a JSON-LD document].  In fact, like the dereferencing
> accessors, both `fromJsonLd()` and `toJsonLd()` methods take option
> `documentLoader` to specify the method to fetch the remote document.
>
> See the
> [*Getting a `DocumentLoader`* section](./context.md#getting-a-documentloader)
> for details.

[JSON-LD]: https://json-ld.org/
[compact/expand a JSON-LD document]: https://www.youtube.com/watch?v=Tm3fD89dqRE


Scalar types
------------

The Activity Vocabulary has a few scalar types that are used as the values of
the properties.  The following table shows the scalar types and their
corresponding TypeScript types:

| Scalar type              | TypeScript type                                   |
|--------------------------|---------------------------------------------------|
| `xsd:boolean`            | `boolean`                                         |
| `xsd:integer`            | `number`                                          |
| `xsd:nonNegativeInteger` | `number`                                          |
| `xsd:float`              | `number`                                          |
| `xsd:string`             | `string`                                          |
| `xsd:anyURI`             | [`URL`]                                           |
| `xsd:dateTime`           | [`Temporal.Instant`]                              |
| `xsd:duration`           | [`Temporal.Duration`]                             |
| `rdf:langString`         | `LanguageString`                                  |
| `w3id:cryptosuiteString` | `"eddsa-jcs-2022"`                                |
| `w3id:multibase`         | [`Uint8Array`]                                    |
| Language tag ([BCP 47])  | [`LanguageTag`]                                   |
| Public key PEM           | [`CryptoKey`]                                     |
| Public key Multibase     | [`CryptoKey`]                                     |
| Proof purpose            | `"assertionMethod" \| "authentication" \| "capabilityInvocation" \| "capabilityDelegation" \| "keyAgreement"` |
| Units                    | `"cm" \| "feet" \| "inches" \| "km" \| "m" \| "miles" \| URL` |

[`URL`]: https://developer.mozilla.org/en-US/docs/Web/API/URL
[`Temporal.Instant`]: https://tc39.es/proposal-temporal/docs/instant.html
[`Temporal.Duration`]: https://tc39.es/proposal-temporal/docs/duration.html
[`Uint8Array`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
[BCP 47]: https://www.rfc-editor.org/info/bcp47
[`LanguageTag`]: https://phensley.github.io/cldr-engine/docs/en/api-languagetag
[`CryptoKey`]: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey
