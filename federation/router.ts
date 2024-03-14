import { Router as InnerRouter } from "uri-template-router";
import { parseTemplate, type Template } from "url-template";

/**
 * URL router and constructor based on URI Template
 * ([RFC 6570](https://tools.ietf.org/html/rfc6570)).
 */
export class Router {
  #router: InnerRouter;
  #templates: Record<string, Template>;

  /**
   * Create a new {@link Router}.
   */
  constructor() {
    this.#router = new InnerRouter();
    this.#templates = {};
  }

  /**
   * Checks if a path name exists in the router.
   * @param name The name of the path.
   * @returns `true` if the path name exists, otherwise `false`.
   */
  has(name: string): boolean {
    return name in this.#templates;
  }

  /**
   * Adds a new path rule to the router.
   * @param template The path pattern.
   * @param name The name of the path.
   * @returns The names of the variables in the path pattern.
   */
  add(template: string, name: string): Set<string> {
    if (!template.startsWith("/")) {
      throw new RouterError("Path must start with a slash.");
    }
    const rule = this.#router.addTemplate(template, {}, name);
    this.#templates[name] = parseTemplate(template);
    return new Set(rule.variables.map((v: { varname: string }) => v.varname));
  }

  /**
   * Resolves a path name and values from a URL, if any match.
   * @param url The URL to resolve.
   * @returns The name of the path and its values, if any match.  Otherwise,
   *          `null`.
   */
  route(url: string): { name: string; values: Record<string, string> } | null {
    const match = this.#router.resolveURI(url);
    if (match == null) return null;
    return {
      name: match.matchValue,
      values: match.params,
    };
  }

  /**
   * Constructs a URL/path from a path name and values.
   * @param name The name of the path.
   * @param values The values to expand the path with.
   * @returns The URL/path, if the name exists.  Otherwise, `null`.
   */
  build(name: string, values: Record<string, string>): string | null {
    if (name in this.#templates) {
      return this.#templates[name].expand(values);
    }
    return null;
  }
}

/**
 * An error thrown by the {@link Router}.
 */
export class RouterError extends Error {
  /**
   * Create a new {@link RouterError}.
   * @param message The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "RouterError";
  }
}
