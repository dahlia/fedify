---
description: >-
  You can register an object dispatcher so that Fedify can dispatch an
  appropriate object by its class and URL arguments.  This section explains
  how to register an object dispatcher.
---

Object dispatcher
=================

*This API is available since Fedify 0.7.0.*

In ActivityPub, [objects] are entities that can be attached to activities or
other objects.  Objects sometimes need to be resolved by their dereferenceable
URIs.  To let objects be resolved, you can register object dispatchers so that
Fedify can dispatch an appropriate object by its class and URL arguments.

An object dispatcher is a callback function that takes a `Context` object and
URL arguments, and returns an object.  Every object dispatcher has one or more
URL parameters that are used to dispatch the object.  The URL parameters are
specified in the path pattern of the object dispatcher, e.g., `/notes/{id}`,
`/users/{handle}/articles/{id}`.

The below example shows how to register an object dispatcher:

~~~~ typescript{7-19} twoslash
// @noErrors: 2345
const note: { id: string; content: string } = { id: "", content: "" };
// ---cut-before---
import { createFederation, Note } from "@fedify/fedify";

const federation = createFederation({
  // Omitted for brevity; see the related section for details.
});

federation.setObjectDispatcher(
  Note,
  "/users/{handle}/notes/{id}",
  async (ctx, { handle, id }) => {
    // Work with the database to find the note by the author's handle and the note ID.
    if (note == null) return null;  // Return null if the note is not found.
    return new Note({
      id: ctx.getObjectUri(Note, { handle, id }),
      content: note.content,
      // Many more properties...
    });
  }
);
~~~~

In the above example, the `~Federation.setObjectDispatcher()` method registers
an object dispatcher for the `Note` class and the `/users/{handle}/notes/{id}`
path.  This pattern syntax follows the [URI Template] specification.

[objects]: https://www.w3.org/TR/activitystreams-core/#object
[URI Template]: https://datatracker.ietf.org/doc/html/rfc6570


Constructing object URIs
------------------------

To construct an object URI, you can use the `Context.getObjectUri()` method.
This method takes a class and URL arguments, and returns a dereferenceable URI
of the object.

The below example shows how to construct an object URI:

~~~~ typescript twoslash
import { type Context, Note } from "@fedify/fedify";
const ctx = null as unknown as Context<void>;
// ---cut-before---
ctx.getObjectUri(Note, { handle: "alice", id: "123" });
~~~~

> [!NOTE]
>
> The `Context.getObjectUri()` method does not guarantee that the object
> actually exists.  It only constructs a URI based on the given class and URL
> arguments, which may respond with `404 Not Found`.  Make sure to check
> if the arguments are valid before calling the method.
