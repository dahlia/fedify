Key–value store
===============

*This API is available since Fedify 0.5.0.*

The `KvStore` interface is a crucial component in Fedify, providing a flexible
key–value storage solution for caching and maintaining internal data.
This guide will help you choose the right `KvStore` implementation for
your project and even create your own custom implementation if needed.


Choosing a `KvStore` implementation
-----------------------------------

Fedify offers several `KvStore` implementations to suit different needs.

Choose the implementation that best fits your project's requirements,
considering factors like scalability, runtime environment, and distributed
nature of your system.

### `MemoryKvStore`

`MemoryKvStore` is a simple in-memory key–value store that doesn't persist data.
It's best suited for development and testing environments where data don't have
to be shared across multiple nodes.  No setup is required, making it easy to
get started.

Best for
:   Development and testing.

Pros
:   Simple, no setup required.

Cons
:   Data is not persistent, not suitable for production.

~~~~ typescript twoslash
import { createFederation, MemoryKvStore } from "@fedify/fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
  // ... other options
});
~~~~

### `DenoKvStore` (Deno only)

`DenoKvStore` is a key–value store implementation for [Deno] runtime that uses
Deno's built-in [`Deno.openKv()`] API. It provides persistent storage and good
performance for Deno environments.  It's suitable for production use in Deno
applications.

Best for
:   Production use in Deno environments.

Pros
:   Persistent storage, good performance, easy to set up.

Cons
:   Only available in Deno runtime.

~~~~ typescript
import { createFederation } from "@fedify/fedify";
import { DenoKvStore } from "@fedify/fedify/x/deno";

const kv = await Deno.openKv();
const federation = createFederation<void>({
  kv: new DenoKvStore(kv),
  // ... other options
});
~~~~

[Deno]: https://deno.com/
[`Deno.openKv()`]: https://docs.deno.com/api/deno/~/Deno.openKv

### [`RedisKvStore`]

> [!NOTE]
> The [`RedisKvStore`] class is available in the [@fedify/redis] package.

[`RedisKvStore`] is a key–value store implementation that uses Redis as
the backend storage. It provides scalability and high performance, making it
suitable for production use in distributed systems.  It requires a Redis
server setup and maintenance.

Best for
:   Production use, distributed systems.

Pros
:   Scalable, supports clustering.

Cons
:   Requires Redis setup and maintenance.

~~~~ typescript twoslash
import { createFederation } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import Redis from "ioredis";

const redis = new Redis(); // Configure as needed
const federation = createFederation<void>({
  kv: new RedisKvStore(redis),
  // ... other options
});
~~~~

[@fedify/redis]: https://github.com/dahlia/fedify-redis
[`RedisKvStore`]: https://jsr.io/@fedify/redis/doc/kv/~/RedisKvStore

### [`PostgresKvStore`]

> [!NOTE]
> The [`PostgresKvStore`] class is available in the [@fedify/postgres] package.

[`PostgresKvStore`] is a key–value store implementation that uses PostgreSQL as
the backend storage. It provides scalability and high performance, making it
suitable for production use in distributed systems.  It requires a PostgreSQL
server setup and maintenance.

Best for
:   Production use, a system that already uses PostgreSQL.

Pros
:   Scalable, no additional setup required if already using PostgreSQL.

Cons
:   Requires PostgreSQL setup and maintenance.

~~~~ typescript{6-8} twoslash
import { createFederation } from "@fedify/fedify";
import { PostgresKvStore } from "@fedify/postgres";
import postgres from "postgres";

const federation = createFederation<void>({
  kv: new PostgresKvStore(
    postgres("postgresql://user:pass@localhost/db"),
  ),
  // ... other options
});
~~~~

[`PostgresKvStore`]: https://jsr.io/@fedify/postgres/doc/kv/~/PostgresKvStore
[@fedify/postgres]: https://github.com/dahlia/fedify-postgres


Implementing a custom `KvStore`
-------------------------------

> [!TIP]
> We are always looking to improve Fedify and add more `KvStore`
> implementations.  If you've created a custom implementation that you think
> would be useful to others, consider contributing it to the community by
> packaging it as a standalone module and sharing it on JSR and npm.

If the provided implementations don't meet your needs, you can create a custom
`KvStore`.  Here's a step-by-step guide:

### Implement the `KvStore` interface

Create a class that implements the `KvStore` interface.  The interface defines
three methods: `~KvStore.get()`, `~KvStore.set()`, and `~KvStore.delete()`:

~~~~ typescript twoslash
import { KvStore, KvKey, KvStoreSetOptions } from "@fedify/fedify";

class MyCustomKvStore implements KvStore {
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    // Implement get logic
    // ---cut-start---
    return undefined;
    // ---cut-end---
  }

  async set(
    key: KvKey,
    value: unknown,
    options?: KvStoreSetOptions
  ): Promise<void> {
    // Implement set logic
  }

  async delete(key: KvKey): Promise<void> {
    // Implement delete logic
  }
}
~~~~

### Handle `KvKey`

The `KvKey` is an array of strings. You'll need to convert it into a format
suitable for your storage backend. For example:

~~~~ typescript twoslash
import type { KvKey } from "@fedify/fedify";
class MyCustomKvStore {
// ---cut-before---
private serializeKey(key: KvKey): string {
  return key.join(':');
}
// ---cut-after---
}
~~~~

> [!NOTE]
> The above example uses a simple colon-separated string as the serialized key,
> but in practice, it probably needs to be more sophisticated to handle complex
> keys and avoid conflicts.

### Implement `~KvStore.get()` method

Retrieve the value associated with the key. Remember to handle cases where
the key doesn't exist:

~~~~ typescript twoslash
import type { KvStore, KvKey, KvStoreSetOptions } from "@fedify/fedify";
/**
 * A hypothetical storage interface.
 */
interface HypotheticalStorage {
  /**
   * A hypothetical method to retrieve a value by key.
   * @param key The key to retrieve.
   * @returns The value associated with the key.
   */
  retrieve(key: string): Promise<unknown>;
}
class MyCustomKvStore implements KvStore {
  /**
   * A hypothetical storage backend.
   */
  storage: HypotheticalStorage = {
   async retrieve(key: string): Promise<unknown> {
     return undefined;
   }
  };
  private serializeKey(key: KvKey): string { return ""; }
  async set(
    key: KvKey,
    value: unknown,
    options?: KvStoreSetOptions
  ): Promise<void> { }
  async delete(key: KvKey): Promise<void> { }
// ---cut-before---
async get<T = unknown>(key: KvKey): Promise<T | undefined> {
  const serializedKey = this.serializeKey(key);
  // Retrieve value from your storage backend
  const value = await this.storage.retrieve(serializedKey);
  return value as T | undefined;
}
// ---cut-after---
}
~~~~

### Implement `~KvStore.set()` method

Store the value with the given key. Handle the optional TTL if your backend
supports it:

~~~~ typescript twoslash
import type { KvStore, KvKey, KvStoreSetOptions } from "@fedify/fedify";
/**
 * A hypothetical storage interface.
 */
interface HypotheticalStorage {
  /**
   * A hypothetical method to set a value by key.
   * @param key The key to set.
   * @param value The value to set.
   */
  set(key: string, value: unknown): Promise<unknown>;
  /**
   * A hypothetical method to set a value by key with a time-to-live.
   * @param key The key to set.
   * @param value The value to set.
   * @param ttl The time-to-live in milliseconds.
   */
  setWithTtl(key: string, value: unknown, ttl: number): Promise<unknown>;
}
class MyCustomKvStore implements KvStore {
  /**
   * A hypothetical storage backend.
   */
  storage: HypotheticalStorage = {
   async set(key: string, value: unknown): Promise<void> { },
   async setWithTtl(key: string, value: unknown, ttl: number): Promise<void> { }
  };
  private serializeKey(key: KvKey): string { return ""; }
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    return undefined;
  }
  async delete(key: KvKey): Promise<void> { }
// ---cut-before---
async set(
  key: KvKey,
  value: unknown,
  options?: KvStoreSetOptions,
): Promise<void> {
  const serializedKey = this.serializeKey(key);
  if (options?.ttl == null) {
    await this.storage.set(serializedKey, value);
  } else {
    // Set with TTL if supported
    await this.storage.setWithTtl(
      serializedKey,
      value,
      options.ttl.total('millisecond'),
    );
  }
}
// ---cut-after---
}
~~~~

*[TTL]: time-to-live

### Implement `~KvStore.delete()` method

Remove the value associated with the key:

~~~~ typescript twoslash
import type { KvStore, KvKey, KvStoreSetOptions } from "@fedify/fedify";
/**
 * A hypothetical storage interface.
 */
interface HypotheticalStorage {
  /**
   * A hypothetical method to remove a value by key.
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}
class MyCustomKvStore implements KvStore {
  /**
   * A hypothetical storage backend.
   */
  storage: HypotheticalStorage = {
   async remove(key: string): Promise<void> { }
  };
  private serializeKey(key: KvKey): string { return ""; }
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    return undefined;
  }
  async set(
    key: KvKey,
    value: unknown,
    options?: KvStoreSetOptions
  ): Promise<void> { }
// ---cut-before---
async delete(key: KvKey): Promise<void> {
  const serializedKey = this.serializeKey(key);
  await this.storage.remove(serializedKey);
}
// ---cut-after---
}
~~~~

### Use your custom `KvStore`

That's it! You can now use your custom `KvStore` implementation with Fedify:

~~~~ typescript twoslash
import { KvStore, KvKey, KvStoreSetOptions } from "@fedify/fedify";
class MyCustomKvStore implements KvStore {
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    return undefined;
  }
  async set(
    key: KvKey,
    value: unknown,
    options?: KvStoreSetOptions
  ): Promise<void> {
  }
  async delete(key: KvKey): Promise<void> {
  }
}
// ---cut-before---
import { createFederation } from "@fedify/fedify";

const customKvStore = new MyCustomKvStore();
const federation = createFederation<void>({
  kv: customKvStore,
  // ... other options
});
~~~~
