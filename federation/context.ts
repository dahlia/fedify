import { Router, RouterError } from "./router.ts";

/**
 * A context for a request.
 */
export class Context<TContextData> {
  #router: Router;

  /**
   * The request object.
   */
  readonly request: Request;

  /**
   * The user-defined data associated with the context.
   */
  readonly data: TContextData;

  /**
   * Create a new context.
   * @param router The router used for the request.
   * @param request The request object.
   * @param data The user-defined data associated with the context.
   */
  constructor(router: Router, request: Request, data: TContextData) {
    this.#router = router;
    this.request = request;
    this.data = data;
  }

  /**
   * Builds the URI of an actor with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's URI.
   */
  getActorUri(handle: string): URL {
    const path = this.#router.build("actor", { handle });
    if (path == null) {
      throw new RouterError("No actor dispatcher registered.");
    }
    return new URL(path, this.request.url);
  }

  /**
   * Builds the URI of an actor's outbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's outbox URI.
   */
  getOutboxUri(handle: string): URL {
    const path = this.#router.build("outbox", { handle });
    if (path == null) {
      throw new RouterError("No outbox dispatcher registered.");
    }
    return new URL(path, this.request.url);
  }
}
