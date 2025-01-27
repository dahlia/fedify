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
[@fedify/redis]: https://github.com/fedify-dev/redis

### [`PostgresMessageQueue`]

> [!NOTE]
> The [`PostgresMessageQueue`] class is available in the [@fedify/postgres]
> package.

[`PostgresMessageQueue`] is a message queue implementation that uses
a PostgreSQL database as the message queue backend.  Under the hood,
it uses a table for maintaining the queue, and [`LISTEN`]/[`NOTIFY`] for
real-time message delivery.  It's suitable for production use if you
already rely on PostgreSQL in your application.

Best for
:   Production use, a system that already uses PostgreSQL.

Pros
:   Persistent, scalable, supports multiple workers.

Cons
:   Requires PostgreSQL setup.

~~~~ typescript{6-8} twoslash
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { PostgresMessageQueue } from "@fedify/postgres";
import postgres from "postgres";

const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: new PostgresMessageQueue(
    postgres("postgresql://user:pass@localhost/db"),
  ),
  // ... other options
});
~~~~

[`PostgresMessageQueue`]: https://jsr.io/@fedify/postgres/doc/mq/~/PostgresMessageQueue
[@fedify/postgres]: https://github.com/fedify-dev/postgres
[`LISTEN`]: https://www.postgresql.org/docs/current/sql-listen.html
[`NOTIFY`]: https://www.postgresql.org/docs/current/sql-notify.html

### `AmqpMessageQueue`

> [!NOTE]
> The [`AmqpMessageQueue`] class is available in the [@fedify/amqp] package.

> [!NOTE]
>
> Although it's theoretically possible to be used with any AMQP 0-9-1 broker,
> [`AmqpMessageQueue`] is primarily designed for and tested with [RabbitMQ].

[`AmqpMessageQueue`] is a message queue implementation that uses AMQP 0-9-1
for message delivery.  The best-known AMQP broker is [RabbitMQ].  It provides
scalability and high performance, making it suitable for production use across
various runtimes.  It requires an AMQP broker setup and management.

Best for
:   Production use across various runtimes.

Pros
:   Persistent, reliable, scalable, supports multiple workers.

Cons
:   Requires AMQP broker setup and management.

~~~~ typescript twoslash
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { AmqpMessageQueue } from "@fedify/amqp";
import { connect } from "amqplib";

const federation = createFederation({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: new AmqpMessageQueue(await connect("amqp://localhost")),  // [!code highlight]
  // ... other options
});
~~~~

*[AMQP]: Advanced Message Queuing Protocol
[`AmqpMessageQueue`]: https://jsr.io/@fedify/amqp/doc/mq/~/AmqpMessageQueue
[@fedify/amqp]: https://github.com/fedify-dev/amqp
[RabbitMQ]: https://www.rabbitmq.com/


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

*This API is available since Fedify 1.0.0.*

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


Using different message queues for different tasks
--------------------------------------------------

*This API is available since Fedify 1.3.0.*

In some cases, you may want to use different message queues for different tasks,
such as using a faster-but-less-persistent queue for outgoing activities and
a slower-but-more-persistent queue for incoming activities.  To achieve this,
you can pass `FederationQueueOptions` to the `CreateFederationOptions.queue`
option.

For example, the following code shows how to use a [`PostgresMessageQueue`] for
the inbox and a [`RedisMessageQueue`] for the outbox:

~~~~ typescript twoslash
import {
  createFederation,
  type KvStore,
  MemoryKvStore,
  type MessageQueue,
} from "@fedify/fedify";
import { PostgresMessageQueue } from "@fedify/postgres";
import { RedisMessageQueue } from "@fedify/redis";
import postgres from "postgres";
import Redis from "ioredis";

// ---cut-before---
const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: {
    inbox: new PostgresMessageQueue(
      postgres("postgresql://user:pass@localhost/db")
    ),
    outbox: new RedisMessageQueue(() => new Redis()),
  },
  // ... other options
});
~~~~

Or, you can provide a message queue for only the `inbox` or `outbox` by omitting
the other:

~~~~ typescript twoslash
import {
  createFederation,
  type KvStore,
  MemoryKvStore,
  type MessageQueue,
} from "@fedify/fedify";
import { PostgresMessageQueue } from "@fedify/postgres";
import postgres from "postgres";

// ---cut-before---
const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  queue: {
    inbox: new PostgresMessageQueue(
      postgres("postgresql://user:pass@localhost/db")
    ),
    // outbox is not provided; outgoing activities will not be queued
  },
  // ... other options
});
~~~~

When you [manually start a task
worker](#separating-message-processing-from-the-main-process), you can specify
which queue to start (if `queue` is not provided in the options, it will start
all queues).  The following example shows how to start only the `inbox` queue:

::: code-group

~~~~ typescript twoslash [Deno]
import type { KvStore } from "@fedify/fedify";
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

// ---cut-before---
if (Deno.env.get("NODE_TYPE") === "worker") {
  const controller = new AbortController();
  Deno.addSignalListener("SIGINT", () => controller.abort());
  await federation.startQueue(undefined, {
    signal: controller.signal,
    queue: "inbox",  // [!code highlight]
  });
}
~~~~

~~~~ typescript twoslash [Node.js/Bun]
import type { KvStore } from "@fedify/fedify";
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

// ---cut-before---
if (process.env.NODE_TYPE === "worker") {
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  await federation.startQueue(undefined, {
    signal: controller.signal,
    queue: "inbox",  // [!code highlight]
  });
}
~~~~

:::
