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
Although Fedify can be used in Node.js and Bun, it's primarily designed for
Deno.  We recommend using Deno for the best experience, but you can use Node.js 
or Bun if you prefer.

> [!TIP]
> If you are new to Deno, but already familiar with Node.js, you can think of
> Deno as a more modern version of Node.js created by the same person, Ryan
> Dahl.  Deno has a lot of improvements over Node.js, such as better security,
> better TypeScript support, better ES module support, and built-in key-value
> store and message queue.

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

~~~~ typescript
import { Federation } from "@fedify/fedify";
~~~~

Or you can directly import it in your code using `jsr:` specifier:

~~~~ typescript
import { Federation } from "jsr:@fedify/fedify";
~~~~


Node.js
-------

Fedify can also be used in Node.js.  As a prerequisite, you need to have Node.js
20.0.0 or later installed on your system.  Then you can install Fedify via
the following command:

~~~~ sh
npm add @fedify/fedify
~~~~

~~~~ typescript
import { Federation } from "@fedify/fedify";
~~~~


Bun
---

Fedify can also be used in Bun.  You can install it via the following
command:

~~~~ sh
bun add @fedify/fedify
~~~~

~~~~ typescript
import { Federation } from "@fedify/fedify";
~~~~
