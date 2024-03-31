/**
 * `KvStore` & `MessageQueue` adapters for Deno's KV store
 * =======================================================
 *
 * This module provides `KvStore` and `MessageQueue` implementations that use
 * Deno's KV store.  The `DenoKvStore` class implements the `KvStore` interface
 * using Deno's KV store, and the `DenoKvMessageQueue` class implements the
 * `MessageQueue` interface using Deno's KV store.
 *
 * @module
 * @since 0.5.0
 */
import type { KvKey, KvStore, KvStoreSetOptions } from "../federation/kv.ts";
import type {
  MessageQueue,
  MessageQueueEnqueueOptions,
} from "../federation/mq.ts";

/**
 * Represents a key-value store implementation using Deno's KV store.
 */
export class DenoKvStore implements KvStore {
  #kv: Deno.Kv;

  /**
   * Constructs a new {@link DenoKvStore} adapter with the given Deno KV store.
   * @param kv The Deno KV store to use.
   */
  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  /**
   * {@inheritDoc KvStore.set}
   */
  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    const entry = await this.#kv.get<T>(key);
    return entry == null || entry.value == null ? undefined : entry.value;
  }

  /**
   * {@inheritDoc KvStore.set}
   */
  async set(
    key: KvKey,
    value: unknown,
    options?: KvStoreSetOptions,
  ): Promise<void> {
    await this.#kv.set(
      key,
      value,
      options?.ttl == null ? undefined : {
        expireIn: options.ttl.total("millisecond"),
      },
    );
  }

  /**
   * {@inheritDoc KvStore.delete}
   */
  delete(key: KvKey): Promise<void> {
    return this.#kv.delete(key);
  }
}

/**
 * Represents a message queue adapter that uses Deno KV store.
 */
export class DenoKvMessageQueue implements MessageQueue {
  #kv: Deno.Kv;

  /**
   * Constructs a new {@link DenoKvMessageQueue} adapter with the given Deno KV
   * store.
   * @param kv The Deno KV store to use.
   */
  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  /**
   * {@inheritDoc MessageQueue.enqueue}
   */
  async enqueue(
    // deno-lint-ignore no-explicit-any
    message: any,
    options?: MessageQueueEnqueueOptions | undefined,
  ): Promise<void> {
    await this.#kv.enqueue(
      message,
      options?.delay == null ? undefined : {
        delay: options.delay.total("millisecond"),
      },
    );
  }

  /**
   * {@inheritDoc MessageQueue.listen}
   */
  // deno-lint-ignore no-explicit-any
  listen(handler: (message: any) => void | Promise<void>): void {
    this.#kv.listenQueue(handler);
  }
}
