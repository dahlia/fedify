// deno-lint-ignore-file no-explicit-any
import type { Temporal } from "@js-temporal/polyfill";

/**
 * Additional options for enqueuing a message in a queue.
 */
export interface MessageQueueEnqueueOptions {
  /**
   * The delay before the message is enqueued.  No delay by default.
   */
  delay?: Temporal.Duration;
}

/**
 * An abstract interface for a message queue.
 */
export interface MessageQueue {
  /**
   * Enqueues a message in the queue.
   * @param message The message to enqueue.
   * @param options Additional options for enqueuing the message.
   */
  enqueue(message: any, options?: MessageQueueEnqueueOptions): Promise<void>;

  /**
   * Listens for messages in the queue.
   * @param handler The handler for messages in the queue.
   */
  listen(handler: (message: any) => Promise<void> | void): void;
}

/**
 * A message queue that processes messages in the same process.
 * Do not use this in production as it does not persist messages.
 */
export class InProcessMessageQueue implements MessageQueue {
  #handlers: ((message: any) => Promise<void> | void)[] = [];

  /**
   * {@inheritDoc Queue.enqueue}
   */
  enqueue(message: any, options?: MessageQueueEnqueueOptions): Promise<void> {
    const delay = options?.delay == null
      ? 0
      : options.delay.total("millisecond");
    setTimeout(() => {
      for (const handler of this.#handlers) handler(message);
    }, delay);
    return Promise.resolve();
  }

  /**
   * {@inheritDoc Queue.listen}
   */
  listen(handler: (message: any) => Promise<void> | void): void {
    this.#handlers.push(handler);
  }
}
