import { lookupWebFinger } from "../webfinger/lookup.ts";
import { Application, Group, Organization, Person, Service } from "./vocab.ts";

/**
 * Actor types are {@link Object} types that are capable of performing
 * activities.
 */
export type Actor = Application | Group | Organization | Person | Service;

/**
 * Checks if the given object is an {@link Actor}.
 * @param object The object to check.
 * @returns `true` if the given object is an {@link Actor}.
 */
export function isActor(object: unknown): object is Actor {
  return (
    object instanceof Application ||
    object instanceof Group ||
    object instanceof Organization ||
    object instanceof Person ||
    object instanceof Service
  );
}

/**
 * A string representation of an actor type name.
 */
export type ActorTypeName =
  | "Application"
  | "Group"
  | "Organization"
  | "Person"
  | "Service";

/**
 * Gets the type name of the given actor.
 * @param actor The actor to get the type name of.
 * @returns The type name of the given actor.
 */
export function getActorTypeName(
  actor: Actor,
): ActorTypeName {
  if (actor instanceof Application) return "Application";
  else if (actor instanceof Group) return "Group";
  else if (actor instanceof Organization) return "Organization";
  else if (actor instanceof Person) return "Person";
  else if (actor instanceof Service) return "Service";
  throw new Error("Unknown actor type.");
}

/**
 * Gets the actor class by the given type name.
 * @param typeName The type name to get the actor class by.
 * @returns The actor class by the given type name.
 */
export function getActorClassByTypeName(
  typeName: ActorTypeName,
):
  | typeof Application
  | typeof Group
  | typeof Organization
  | typeof Person
  | typeof Service {
  switch (typeName) {
    case "Application":
      return Application;
    case "Group":
      return Group;
    case "Organization":
      return Organization;
    case "Person":
      return Person;
    case "Service":
      return Service;
  }
  throw new Error("Unknown actor type name.");
}

/**
 * Gets the actor handle, of the form `@username@domain`, from the given actor
 * or an actor URI.
 *
 * @example
 * ``` typescript
 * // Get the handle of an actor object:
 * await getActorHandle(
 *   new Person({ id: new URL("https://todon.eu/users/hongminhee") })
 * );
 *
 * // Get the handle of an actor URI:
 * await getActorHandle(new URL("https://todon.eu/users/hongminhee"));
 * ```
 *
 * @param actor The actor or actor URI to get the handle from.
 * @returns The actor handle.  It starts with `@` and is followed by the
 *          username and domain, separated by `@`.
 * @throws {TypeError} If the actor does not have enough information to get the
 *                     handle.
 */
export async function getActorHandle(
  actor: Actor | URL,
): Promise<`@${string}@${string}`> {
  const actorId = actor instanceof URL ? actor : actor.id;
  if (actorId != null) {
    const result = await lookupWebFinger(actorId);
    if (result != null) {
      const aliases = [...(result.aliases ?? [])];
      if (result.subject != null) aliases.unshift(result.subject);
      for (const alias of aliases) {
        const match = alias.match(/^acct:([^@]+)@([^@]+)$/);
        if (match != null) return `@${match[1]}@${match[2]}`;
      }
    }
  }
  if (
    !(actor instanceof URL) && actor.preferredUsername != null &&
    actor.id != null
  ) {
    return `@${actor.preferredUsername}@${actor.id.host}`;
  }
  throw new TypeError(
    "Actor does not have enough information to get the handle.",
  );
}
