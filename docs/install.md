---
description: How to install Fedify.
prev:
  text: What is Fedify?
  link: ./intro.md
next:
  text: Tutorial
  link: ./tutorial.md
---
Installation
============

Fedify is available on [JSR] for [Deno] and on [npm] for [Node.js] and [Bun].

> [!TIP]
> We recommend using Deno or Bun (which are TypeScript-first) for the best
> experience, but you can use Node.js if you prefer.

[JSR]: https://jsr.io/@fedify/fedify
[Deno]: https://deno.com/
[npm]: https://www.npmjs.com/package/@fedify/fedify
[Node.js]: https://nodejs.org/
[Bun]: https://bun.sh/


Deno
----

[Deno] is the primary runtime for Fedify.  As a prerequisite, you need to have
Deno 1.41.0 or later installed on your system.  Then you can install Fedify
via the following command:

~~~~ sh
deno add @fedify/fedify
~~~~

Since Fedify requires [`Temporal`] API, which is an unstable feature in Deno as
of May 2024, you need to add the `"temporal"` to the `"unstable"` field of
the *deno.json* file:

~~~~ json{5}
{
  "imports": {
    "@fedify/fedify": "jsr:@fedify/fedify"
  },
  "unstable": ["temporal"]
}
~~~~

[`Temporal`]: https://tc39.es/proposal-temporal/docs/


Node.js
-------

Fedify can also be used in Node.js.  As a prerequisite, you need to have Node.js
20.0.0 or later installed on your system.  Then you can install Fedify via
the following command:

~~~~ sh
npm add @fedify/fedify
~~~~

Fedify is an ESM-only package, so you need to add `"type": "module"` to the
*package.json* file:

~~~~ json{2}
{
  "type": "module",
  "dependencies": {
    "@fedify/fedify": "^0.10.0"
  }
}
~~~~


Bun
---

Fedify can also be used in Bun.  You can install it via the following
command:

~~~~ sh
bun add @fedify/fedify
~~~~
