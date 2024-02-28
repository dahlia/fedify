import { Actor } from "../vocab/actor.ts";
import { CryptographicKey } from "../vocab/mod.ts";
import { Activity } from "../vocab/mod.ts";
import { Page } from "./collection.ts";
import { RequestContext } from "./context.ts";

/**
 * A callback that dispatches an {@link Actor} object.
 */
export type ActorDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  key: CryptographicKey | null,
) => Actor | null | Promise<Actor | null>;

/**
 * A callback that dispatches a key pair for an actor.
 */
export type ActorKeyPairDispatcher<TContextData> = (
  contextData: TContextData,
  handle: string,
) => CryptoKeyPair | null | Promise<CryptoKeyPair | null>;

/**
 * A callback that dispatches an outbox.
 */
export type OutboxDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  cursor: string | null,
) => Page<Activity> | null | Promise<Page<Activity> | null>;

/**
 * A callback that counts the number of activities in an outbox.
 */
export type OutboxCounter<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
) => number | bigint | null | Promise<number | bigint | null>;

/**
 * A callback that returns a cursor for an outbox.
 */
export type OutboxCursor<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
) => string | null | Promise<string | null>;

/**
 * A callback that listens for activities in an inbox.
 */
export type InboxListener<TContextData, TActivity extends Activity> = (
  context: RequestContext<TContextData>,
  activity: TActivity,
) => void | Promise<void>;
