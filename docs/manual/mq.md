Message queue
=============

*This API is available since Fedify 0.5.0.*

The `MessageQueue` interface in Fedify provides an abstraction for handling
asynchronous message processing. This document will help you understand
how to choose a `MessageQueue` implementation and how to create your own custom
implementation if needed.


Choosing a `MessageQueue` implementation
----------------------------------------

When choosing an implementation, consider the following factors:

 1. *Runtime environment*: Are you using [Deno], [Node.js], [Bun],
    or another JavaScript runtime?
 2. *Scalability need*: Do you need to support multiple workers or servers?
 3. *Persistence requirements*: Do messages need to survive server restarts?
 4. *Development vs. production*: Are you in a development/testing phase or
    deploying to production?

Fedify provides several built-in `MessageQueue` implementations,
each suited for different use cases:

[Deno]: https://deno.com/
[Node.js]: https://nodejs.org/
[Bun]: https://bun.sh/

### `InProcessMessageQueue`

`InProcessMessageQueue` is a simple in-memory message queue that doesn't persist
messages between restarts. It's best suited for development and testing
environments.

Best for
:   Development and testing.

Pros
:   Simple, no external dependencies.

Cons
:   Not suitable for production, doesn't persist messages between restarts.

~~~~ typescript twoslash
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation, InProcessMessageQueue } from "@fedify/fedify";

const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: new InProcessMessageQueue(),  // [!code highlight]
  // ... other options
});
~~~~

### `DenoKvMessageQueue` (Deno only)

`DenoKvMessageQueue` is a message queue implementation for [Deno] runtime that
uses Deno's built-in [`Deno.openKv()`] API. It provides persistent storage and
good performance for Deno environments.  It's suitable for production use in
Deno applications.

Best for
:   Production use in Deno environments.

Pros
:   Persistent, scalable, easy to set up.

Cons
:   Only available in Deno runtime.

~~~~ typescript
import { createFederation } from "@fedify/fedify";
import { DenoKvMessageQueue } from "@fedify/fedify/x/deno";

const kv = await Deno.openKv();
const federation = createFederation<void>({
  queue: new DenoKvMessageQueue(kv),  // [!code highlight]
  // ... other options
});
~~~~

[`Deno.openKv()`]: https://docs.deno.com/api/deno/~/Deno.openKv

### [`RedisMessageQueue`]

> [!NOTE]
> The [`RedisMessageQueue`] class is available in the [@fedify/redis] package.

[`RedisMessageQueue`] is a message queue implementation that uses Redis as
the backend. It provides scalability and high performance, making it
suitable for production use across various runtimes.  It requires a Redis
server setup and management.

Best for
:   Production use across various runtimes.

Pros
:   Persistent, scalable, supports multiple workers.

Cons
:   Requires Redis setup and management.

~~~~ typescript twoslash
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { RedisMessageQueue } from "@fedify/redis";
import Redis from "ioredis";

const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: new RedisMessageQueue(() => new Redis()),  // [!code highlight]
  // ... other options
});
~~~~

[`RedisMessageQueue`]: https://jsr.io/@fedify/redis/doc/mq/~/RedisMessageQueue
[@fedify/redis]: https://github.com/dahlia/fedify-redis


Implementing a custom `MessageQueue`
------------------------------------

If the built-in implementations don't meet your needs, you can create a custom
`MessageQueue`.  Here's a guide to implementing your own:

### Implement the `MessageQueue` interface

Create a class that implements the `MessageQueue` interface, which includes
the `~MessageQueue.enqueue()` and `~MessageQueue.listen()` methods:

~~~~ typescript twoslash
import type {
  MessageQueue,
  MessageQueueEnqueueOptions,
  MessageQueueListenOptions,
} from "@fedify/fedify";

class CustomMessageQueue implements MessageQueue {
  async enqueue(
    message: any,
    options?: MessageQueueEnqueueOptions,
  ): Promise<void> {
    // Implementation here
  }

  async listen(
    handler: (message: any) => Promise<void> | void,
    options: MessageQueueListenOptions = {},
  ): Promise<void> {
    // Implementation here
  }
}
~~~~

### Implement `~MessageQueue.enqueue()` method

This method should add the message to your queue system.
Handle the `~MessageQueueEnqueueOptions.delay` option if provided in
`MessageQueueEnqueueOptions`.  Ensure the method is non-blocking
(use async operations where necessary).

### Implement `~MessageQueue.listen()` method

This method should start a process that listens for new messages.
When a message is received, it should call the provided `handler` function.
Ensure proper error handling to prevent the listener from crashing.

> [!NOTE]
> A `Promise` object it returns should never resolve unless the given
> `~MessageQueueListenOptions.signal` is triggered.

### Consider additional features

Here's a list of additional features you might want to implement in your
custom `MessageQueue`:

 -  *Message persistence*: Store messages in a database or file system
    if your backend doesn't provide persistence.
 -  *Multiple workers*: Guarantee a queue can be consumed by multiple workers.
 -  *Message acknowledgment*: Implement message acknowledgment to ensure
    messages are processed only once.  

However, you don't need to implement retry logic yourself, as Fedify handles
retrying failed messages automatically.


Parallel message processing
---------------------------

*This API is available since Fedify 1.0.0.*

Fedify supports parallel message processing by running multiple workers
concurrently.  To enable parallel processing, wrap your `MessageQueue` with
`ParallelMessageQueue`, a special implementation of the `MessageQueue` interface
designed to process messages in parallel.  It acts as a decorator for another
`MessageQueue` implementation, allowing for concurrent processing of messages
up to a specified number of workers:

~~~~ typescript twoslash
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation, ParallelMessageQueue } from "@fedify/fedify";
import { RedisMessageQueue } from "@fedify/redis";
import Redis from "ioredis";

const baseQueue = new RedisMessageQueue(() => new Redis());

// Use parallelQueue in your Federation configuration
const federation = createFederation<void>({
  queue: new ParallelMessageQueue(baseQueue, 5),  // [!code highlight]
  // ... other options
  // ---cut-start---
  kv: null as unknown as KvStore,
  // ---cut-end---
});
~~~~

> [!NOTE]
> The workers do not run in truly parallel, in the sense that they are not
> running in separate threads or processes.  They are running in the same
> process, but are scheduled to run in parallel.  Hence, this is useful for
> I/O-bound tasks, but not for CPU-bound tasks, which is okay for Fedify's
> workloads.
>
> If your [inbox listeners](./inbox.md) are CPU-bound, you should consider
> running multiple nodes of your application so that each node can process
> messages in parallel with the shared message queue.


Separating message processing from the main process
---------------------------------------------------

*This API is available since Fedify 0.12.0.*

On high-traffic servers, it's common to separate message processing from
the main server process to avoid blocking the main event loop.  To achieve this,
you can use the `~CreateFederationOptions.manuallyStartQueue` option and
`Federation.startQueue()` method:

::: code-group

~~~~ typescript{11-17} twoslash [Deno]
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { RedisMessageQueue } from "@fedify/redis";
import Redis from "ioredis";

const federation = createFederation<void>({
  queue: new RedisMessageQueue(() => new Redis()),
  manuallyStartQueue: true,  // [!code highlight]
  // ... other options
  // ---cut-start---
  kv: null as unknown as KvStore,
  // ---cut-end---
});

// Start the message queue manually only in worker nodes.
// On non-worker nodes, the queue won't be started.
if (Deno.env.get("NODE_TYPE") === "worker") {
  const controller = new AbortController();
  Deno.addSignalListener("SIGINT", () => controller.abort());
  await federation.startQueue(undefined, { signal: controller.signal });
}
~~~~

~~~~ typescript{12-18} twoslash [Node.js/Bun]
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { RedisMessageQueue } from "@fedify/redis";
import Redis from "ioredis";
import process from "node:process";

const federation = createFederation<void>({
  queue: new RedisMessageQueue(() => new Redis()),
  manuallyStartQueue: true,  // [!code highlight]
  // ... other options
  // ---cut-start---
  kv: null as unknown as KvStore,
  // ---cut-end---
});

// Start the message queue manually only in worker nodes.
// On non-worker nodes, the queue won't be started.
if (process.env.NODE_TYPE === "worker") {
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  await federation.startQueue(undefined, { signal: controller.signal });
}
~~~~

:::

The key point is to ensure that messages are enqueued only from
the `NODE_TYPE=web` nodes, and messages are processed only from
the `NODE_TYPE=worker` nodes:

| `NODE_TYPE` | Process messages? | Enqueue messages? |
|-------------|-------------------|-------------------|
| `web`       | Do not process    | Enqueue           |
| `worker`    | Process           | Do not enqueue    |

This separation allows you to scale your application by running multiple worker
nodes that process messages concurrently.  It also helps to keep the main
server process responsive by offloading message processing to worker nodes.

> [!NOTE]
> To ensure that messages are enqueued only from the `NODE_TYPE=web` nodes,
> you should not place the `NODE_TYPE=worker` nodes behind a load balancer.
