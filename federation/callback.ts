import { Actor } from "../vocab/actor.ts";
import { Activity } from "../vocab/mod.ts";
import { Page } from "./collection.ts";
import { Context } from "./context.ts";

/**
 * A callback that dispatches an {@link Actor} object.
 */
export type ActorDispatcher<TContextData> = (
  context: Context<TContextData>,
  handle: string,
) => Actor | null | Promise<Actor | null>;

/**
 * A callback that dispatches an outbox.
 */
export type OutboxDispatcher<TContextData> = (
  context: Context<TContextData>,
  handle: string,
  cursor: string | null,
) => Page<Activity> | null | Promise<Page<Activity> | null>;

/**
 * A callback that counts the number of activities in an outbox.
 */
export type OutboxCounter<TContextData> = (
  context: Context<TContextData>,
  handle: string,
) => number | bigint | null | Promise<number | bigint | null>;

/**
 * A callback that returns a cursor for an outbox.
 */
export type OutboxCursor<TContextData> = (
  context: Context<TContextData>,
  handle: string,
) => string | null | Promise<string | null>;
