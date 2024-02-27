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
   * The URL of the request.
   */
  readonly url: URL;

  /**
   * Create a new context.
   * @param router The router used for the request.
   * @param request The request object.
   * @param data The user-defined data associated with the context.
   * @param treatHttps Whether to treat the request as HTTPS even if it's not.
   */
  constructor(
    router: Router,
    request: Request,
    data: TContextData,
    treatHttps = false,
  ) {
    this.#router = router;
    this.request = request;
    this.data = data;
    this.url = new URL(request.url);
    if (treatHttps) this.url.protocol = "https:";
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
    return new URL(path, this.url);
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
    return new URL(path, this.url);
  }

  /**
   * Builds the URI of an actor's inbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's inbox URI.
   */
  getInboxUri(handle: string): URL {
    const path = this.#router.build("inbox", { handle });
    if (path == null) {
      throw new RouterError("No inbox path registered.");
    }
    return new URL(path, this.url);
  }
}
