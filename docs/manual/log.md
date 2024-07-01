---
description: >-
  Logging is a useful tool for debugging your federated server app.  This
  section explains how to enable logging in your federated server app.
prev:
  text: Testing
  link: ./test.md
next: false
---

Logging
=======

*This API is available since Fedify 0.7.0.*

> [!TIP]
> We highly recommend enabling logging in your federated server app to debug
> your app easily.

Fedify uses the [LogTape] package to log message.  You can enable logging in
your federated server app by installing the `@logtape/logtape` package and
configuring it in the entry point of your app.

[LogTape]: https://github.com/dahlia/logtape


Setting up LogTape
------------------

To enable logging in your federated server app, you need to install the
`@logtape/logtape` package (available on both [JSR] and [npm]):

::: code-group

~~~~ sh [Deno]
deno add @logtape/logtape
~~~~

~~~~ sh [Node.js]
npm add @logtape/logtape
~~~~

~~~~ sh [Bun]
bun add @logtape/logtape
~~~~

:::

Then, you can [`configure()`] the logger in the entry point of your app:

~~~~ typescript
import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [
    { category: "your-app", sinks: ["console"], level: "debug" },
    { category: "fedify",   sinks: ["console"], level: "error" },
  ],
});
~~~~

The `configure()` function takes an object with three properties:

`sinks` (mandatory)
:   An object that maps sink names to sink instances.  In this example, we use
    the `getConsoleSink()` function to get a console sink instance.

`filters` (mandatory)
:   An object that maps logger categories to filter functions.  In this example,
    we use an empty object to disable filtering.

`loggers` (mandatory)
:   An array of logger configurations.  Each configuration is an object with
    four properties:
    
`loggers.category` (mandatory)
:   The `category` property is an array of string or a string that specifies
    the logger category.  If a string is given, it is treated as an array
    with a single element.

`loggers.sinks` (optional)
:   The `sinks` property is an array of string that specifies the sink names
    that the logger should use.

`loggers.filters` (optional)
:   The `filters` property is an array of string that specifies the filter
    names that the logger should use.

`loggers.level` (optional)
:   The `level` property is a string that specifies the log level.  The log
    level can be one of the following: `"debug"`, `"info"`, `"warning"`,
    `"error"`, or `"fatal"`.

[JSR]: https://jsr.io/@logtape/logtape
[npm]: https://www.npmjs.com/package/@logtape/logtape
[`configure()`]: https://jsr.io/@logtape/logtape/doc/~/configure


Categories
----------

> [!TIP]
> A logger category is an array of strings that specifies the logger category.
> The logger category is used to filter log messages, or to configure
> the specific sink for the logger.  Since it's hierarchical, you can filter
> out log messages by specifying a prefix of the logger category while
> seeing log messages of a specific subcategory.
>
> Note that the logger category is case-sensitive.  A bare string is treated
> as an array with a single element.

Fedify uses the following logger categories:

### `"fedify"`

The `"fedify"` category is used for everything related to the Fedify library.

### `["fedify", "federation"]`

The `["fedify", "federation"]` category is used for logging federation-related
messages.

### `["fedify", "federation", "actor"]`

*This category is available since Fedify 0.9.0.*

The `["fedify", "federation", "actor"]` category is used for logging messages
related to actor dispatcher.

### `["fedify", "federation", "collection"]`

*This category is available since Fedify 0.8.0.*

The `["fedify", "federation", "collection"]` category is used for logging
messages related to collections (e.g., outbox, followers, following).

### `["fedify", "federation", "http"]`

*This category is available since Fedify 0.9.0.*

The `["fedify", "federation", "http"]` category is used for logging messages
related to HTTP requests and responses.  When you are curious about the
HTTP requests and responses, you can check the log messages in this category
with the `"info"` level.

### `["fedify", "federation", "inbox"]`

The `["fedify", "federation", "inbox"]` category is used for logging messages
related to incoming activities.  When you cannot receive an activity, you can
check the log messages in this category with the `"debug"` level.

### `["fedify", "federation", "outbox"]`

The `["fedify", "federation", "outbox"]` category is used for logging messages
related to outgoing activities.  When you cannot send an activity, you can
check the log messages in this category with the `"debug"` level.

### `["fedify", "federation", "queue"]`

*This category is available since Fedify 0.12.0.*

The `["fedify", "federation", "queue"]` category is used for logging messages
related to the task queue.  When you are curious about the task queue, you can
check the log messages in this category with the `"debug"` level.

### `["fedify", "httpsig", "verify"]`

*This category is available since Fedify 0.8.0.*

The `["fedify", "httpsig", "verify"]` category is used for logging messages
related to the verification of HTTP Signatures.  When you are curious about
the verification process, you can check the log messages in this category with
the `"debug"` level.

### `["fedify", "runtime", "docloader"]`

*This category is available since Fedify 0.8.0.*

The `["fedify", "runtime", "docloader"]` category is used for logging messages
related to the document loader.  When you are curious about what specific
requests are made by the document loader, you can check the log messages in
this category with the `"debug"` level.

### `["fedify", "sig", "proof"]`

*This category is available since Fedify 0.10.0.*

The `["fedify", "sig", "proof"]` category is used for logging messages related
to Object Integrity Proofs.  When you are curious about the proof verification
process, you can check the log messages in this category with the `"debug"`
level.

### `["fedify", "sig", "key"]`

*This category is available since Fedify 0.10.0.*

The `["fedify", "sig", "key"]` category is used for logging messages related
to key generation and key retrieval.  When you are curious about these
processes, you can check the log messages in this category with the `"debug"`
level.

### `["fedify", "vocab", "lookup"]`

*This category is available since Fedify 0.10.0.*

The `["fedify", "vocab", "lookup"]` category is used for logging messages
related to looking up ActivityPub objects.  When you are curious about the
lookup process, you can check the log messages in this category with the
`"debug"` level.

### `["fedify", "webfinger", "lookup"]`

*This category is available since Fedify 0.10.0.*

The `["fedify", "webfinger", "lookup"]` category is used for logging messages
related to looking up WebFinger resources.  When you are curious about the
lookup process, you can check the log messages in this category with the
`"debug"` level.

### `["fedify", "x", "fresh"]`

The `["fedify", "x", "fresh"]` category is used for logging messages related
to the `@fedify/fedify/x/fresh` module.


Sinks
-----

A sink is a destination where log messages are sent.  LogTape provides few
built-in sinks:

 -  [console sink]
 -  [stream sink]
 -  [file sink]
 -  [rotating file sink]

However, you can create your own sink by implementing the [`Sink`] interface,
e.g., to send log messages to a database or a cloud service.

For more information about sinks, see the [*Sinks* section] in the LogTape docs.

[console sink]: https://github.com/dahlia/logtape?tab=readme-ov-file#console-sink
[stream sink]: https://github.com/dahlia/logtape?tab=readme-ov-file#stream-sink
[file sink]: https://github.com/dahlia/logtape?tab=readme-ov-file#file-sink
[rotating file sink]: https://github.com/dahlia/logtape?tab=readme-ov-file#rotating-file-sink
[`Sink`]: https://jsr.io/@logtape/logtape/doc/~/Sink
[*Sinks* section]: https://github.com/dahlia/logtape?tab=readme-ov-file#sinks


Deprecation warnings
--------------------

When you are using deprecated APIs, you can see deprecation warnings in the
log messages.  The deprecation warnings are logged with the `"warning"` level
in each category where the deprecated API is used.  If you want to see all
deprecation warnings, you can set the log level to `"warning"` for the
[`"fedify"` category](#fedify).
