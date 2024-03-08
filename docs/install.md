---
nav_order: 2
---
Installation
============

As a prerequisite, you need to have [Deno] 1.41.0 or later installed on your
system.  Then you can install Fedify via the following command:

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

[Deno]: https://deno.com/
