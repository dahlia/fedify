import { Actor } from "../vocab/actor.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import {
  ActorDispatcher,
  OutboxCounter,
  OutboxCursor,
  OutboxDispatcher,
} from "./callback.ts";
import { Context } from "./context.ts";
import { handleActor, handleOutbox } from "./handler.ts";
import { RouterError } from "./router.ts";
import { Router } from "./router.ts";

/**
 * An object that registers federation-related business logic and dispatches
 * requests to the appropriate handlers.
 *
 * It also provides a middleware interface for handling requests before your
 * web framework's router; see {@link Federation.handle}.
 */
export class Federation<TContextData> {
  #router: Router;
  #actorDispatcher?: ActorDispatcher<TContextData>;
  #outboxCallbacks?: {
    dispatcher: OutboxDispatcher<TContextData>;
    counter?: OutboxCounter<TContextData>;
    firstCursor?: OutboxCursor<TContextData>;
    lastCursor?: OutboxCursor<TContextData>;
  };

  /**
   * Create a new {@link Federation} instance.
   */
  constructor() {
    this.#router = new Router();
    this.#router.add("/.well-known/webfinger", "webfinger");
  }

  /**
   * Registers an actor dispatcher.
   * @param path The URI path pattern for the actor dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An actor dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setActorDispatcher(
    path: string,
    dispatcher: ActorDispatcher<TContextData>,
  ): void {
    const variables = this.#router.add(path, "actor");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for actor dispatcher must have one variable: {handle}",
      );
    }
    this.#actorDispatcher = dispatcher;
  }

  /**
   * Registers an outbox dispatcher.
   * @param path The URI path pattern for the outbox dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An outbox dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setOutboxDispatcher(
    path: string,
    dispatcher: OutboxDispatcher<TContextData>,
  ): OutboxCallbackSetters<TContextData> {
    const variables = this.#router.add(path, "outbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for outbox dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: {
      dispatcher: OutboxDispatcher<TContextData>;
      counter?: OutboxCounter<TContextData>;
      firstCursor?: OutboxCursor<TContextData>;
      lastCursor?: OutboxCursor<TContextData>;
    } = { dispatcher };
    this.#outboxCallbacks = callbacks;
    const setters: OutboxCallbackSetters<TContextData> = {
      setCounter(counter: OutboxCounter<TContextData>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: OutboxCursor<TContextData>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: OutboxCursor<TContextData>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Handles a request related to federation.
   * @param request The request object.
   * @param parameters The parameters for handling the request.
   * @returns The response to the request.
   */
  async handle(
    request: Request,
    {
      onNotFound,
      onNotAcceptable,
      contextData,
    }: FederationHandlerParameters<TContextData>,
  ): Promise<Response> {
    const url = new URL(request.url);
    const route = this.#router.route(url.pathname);
    if (route == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    switch (route.name) {
      case "webfinger":
        return await handleWebFinger(request, {
          router: this.#router,
          contextData,
          actorDispatcher: this.#actorDispatcher,
          onNotFound,
        });
      case "actor":
        return await handleActor(request, {
          handle: route.values.handle,
          router: this.#router,
          contextData,
          actorDispatcher: this.#actorDispatcher,
          onNotFound,
          onNotAcceptable,
        });
      case "outbox":
        return await handleOutbox(request, {
          handle: route.values.handle,
          router: this.#router,
          contextData,
          outboxDispatcher: this.#outboxCallbacks?.dispatcher,
          outboxCounter: this.#outboxCallbacks?.counter,
          outboxFirstCursor: this.#outboxCallbacks?.firstCursor,
          outboxLastCursor: this.#outboxCallbacks?.lastCursor,
          onNotFound,
          onNotAcceptable,
        });
      default: {
        const response = onNotFound(request);
        return response instanceof Promise ? await response : response;
      }
    }
  }
}

export interface FederationHandlerParameters<TContextData> {
  contextData: TContextData;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

interface OutboxCallbackSetters<TContextData> {
  setCounter(
    counter: OutboxCounter<TContextData>,
  ): OutboxCallbackSetters<TContextData>;

  setFirstCursor(
    cursor: OutboxCursor<TContextData>,
  ): OutboxCallbackSetters<TContextData>;

  setLastCursor(
    cursor: OutboxCursor<TContextData>,
  ): OutboxCallbackSetters<TContextData>;
}
