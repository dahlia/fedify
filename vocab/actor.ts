import { Application, Group, Organization, Person, Service } from "./mod.ts";

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
