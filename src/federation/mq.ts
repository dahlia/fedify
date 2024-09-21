// deno-lint-ignore-file no-explicit-any

/**
 * Additional options for enqueuing a message in a queue.
 *
 * @since 0.5.0
 */
export interface MessageQueueEnqueueOptions {
  /**
   * The delay before the message is enqueued.  No delay by default.
   *
   * It must not be negative.
   */
  delay?: Temporal.Duration;
}

/**
 * An abstract interface for a message queue.
 *
 * @since 0.5.0
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
 *
 * @since 0.5.0
 */
export class InProcessMessageQueue implements MessageQueue {
  #handlers: ((message: any) => Promise<void> | void)[] = [];

  enqueue(message: any, options?: MessageQueueEnqueueOptions): Promise<void> {
    const delay = options?.delay == null
      ? 0
      : Math.max(options.delay.total("millisecond"), 0);
    setTimeout(() => {
      for (const handler of this.#handlers) handler(message);
    }, delay);
    return Promise.resolve();
  }

  listen(handler: (message: any) => Promise<void> | void): void {
    this.#handlers.push(handler);
  }
}

type Uuid = ReturnType<typeof crypto.randomUUID>;

/**
 * A message queue that processes messages in parallel.  It takes another
 * {@link MessageQueue}, and processes messages in parallel up to a certain
 * number of workers.
 *
 * Actually, it's rather a decorator than a queue itself.
 *
 * Note that the workers do not run in truly parallel, in the sense that they
 * are not running in separate threads or processes.  They are running in the
 * same process, but are scheduled to run in parallel.  Hence, this is useful
 * for I/O-bound tasks, but not for CPU-bound tasks, which is okay for Fedify's
 * workloads.
 *
 * @since 1.0.0
 */
export class ParallelMessageQueue implements MessageQueue {
  readonly queue: MessageQueue;
  readonly workers: number;

  /**
   * Constructs a new {@link ParallelMessageQueue} with the given queue and
   * number of workers.
   * @param queue The message queue to use under the hood.  Note that
   *              {@link ParallelMessageQueue} cannot be nested.
   * @param workers The number of workers to process messages in parallel.
   * @throws {TypeError} If the given queue is an instance of
   *                     {@link ParallelMessageQueue}.
   */
  constructor(queue: MessageQueue, workers: number) {
    if (queue instanceof ParallelMessageQueue) {
      throw new TypeError("Cannot nest ParallelMessageQueue.");
    }
    this.queue = queue;
    this.workers = workers;
  }

  enqueue(message: any, options?: MessageQueueEnqueueOptions): Promise<void> {
    return this.queue.enqueue(message, options);
  }

  listen(handler: (message: any) => Promise<void> | void): void {
    const workers = new Map<Uuid, Promise<Uuid>>();
    this.queue.listen(async (message) => {
      while (workers.size >= this.workers) {
        const consumedId = await Promise.any(workers.values());
        workers.delete(consumedId);
      }
      const workerId = crypto.randomUUID();
      const promise = this.#work(workerId, handler, message);
      workers.set(workerId, promise);
    });
  }

  async #work(
    workerId: Uuid,
    handler: (message: any) => Promise<void> | void,
    message: any,
  ): Promise<Uuid> {
    await this.#sleep(0);
    await handler(message);
    return workerId;
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
