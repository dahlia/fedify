import type { Link, Object } from "./vocab.ts";

/**
 * Returns the type URI of the given object.
 *
 * @example
 * ``` typescript
 * import { getTypeId, Person } from "@fedify/fedify";
 *
 * const obj = new Person({});
 * console.log(getTypeId(obj));
 * // => new URL("https://www.w3.org/ns/activitystreams#Person")
 * ```
 *
 * @param object The Activity Vocabulary object.
 * @returns The type URI of the object, e.g.,
 *          `new URL("https://www.w3.org/ns/activitystreams#Person")`.
 *          If the given `object` is `null` or `undefined`, returns `null` or
 *          `undefined`, respectively.
 * @since 1.3.0
 */
export function getTypeId(object: Object | Link): URL;

/**
 * Returns the type URI of the given object.
 *
 * @example
 * ``` typescript
 * import { getTypeId, Person } from "@fedify/fedify";
 *
 * const obj = new Person({});
 * console.log(getTypeId(obj));
 * // => new URL("https://www.w3.org/ns/activitystreams#Person")
 * ```
 *
 * @param object The Activity Vocabulary object.
 * @returns The type URI of the object, e.g.,
 *          `new URL("https://www.w3.org/ns/activitystreams#Person")`.
 *          If the given `object` is `null` or `undefined`, returns `null` or
 *          `undefined`, respectively.
 * @since 1.3.0
 */
export function getTypeId(object: Object | Link | undefined): URL | undefined;

/**
 * Returns the type URI of the given object.
 *
 * @example
 * ``` typescript
 * import { getTypeId, Person } from "@fedify/fedify";
 *
 * const obj = new Person({});
 * console.log(getTypeId(obj));
 * // => new URL("https://www.w3.org/ns/activitystreams#Person")
 * ```
 *
 * @param object The Activity Vocabulary object.
 * @returns The type URI of the object, e.g.,
 *          `new URL("https://www.w3.org/ns/activitystreams#Person")`.
 *          If the given `object` is `null` or `undefined`, returns `null` or
 *          `undefined`, respectively.
 * @since 1.3.0
 */
export function getTypeId(object: Object | Link | null): URL | null;

/**
 * Returns the type URI of the given object.
 *
 * @example
 * ``` typescript
 * import { getTypeId, Person } from "@fedify/fedify";
 *
 * const obj = new Person({});
 * console.log(getTypeId(obj));
 * // => new URL("https://www.w3.org/ns/activitystreams#Person")
 * ```
 *
 * @param object The Activity Vocabulary object.
 * @returns The type URI of the object, e.g.,
 *          `new URL("https://www.w3.org/ns/activitystreams#Person")`.
 *          If the given `object` is `null` or `undefined`, returns `null` or
 *          `undefined`, respectively.
 * @since 1.3.0
 */
export function getTypeId(
  object: Object | Link | null | undefined,
): URL | null | undefined;

export function getTypeId(
  object: Object | Link | undefined | null,
): URL | undefined | null {
  if (object == null) return object;
  const cls = object.constructor as
    & (new (...args: unknown[]) => Object | Link)
    & {
      typeId: URL;
    };
  return cls.typeId;
}
