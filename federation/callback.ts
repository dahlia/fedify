import type { NodeInfo } from "../nodeinfo/types.ts";
import type { Actor } from "../vocab/actor.ts";
import type { Activity, CryptographicKey } from "../vocab/mod.ts";
import type { PageItems } from "./collection.ts";
import type { RequestContext } from "./context.ts";

/**
 * A callback that dispatches a {@link NodeInfo} object.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type NodeInfoDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
) => NodeInfo | Promise<NodeInfo>;

/**
 * A callback that dispatches an {@link Actor} object.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type ActorDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  key: CryptographicKey | null,
) => Actor | null | Promise<Actor | null>;

/**
 * A callback that dispatches a key pair for an actor.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type ActorKeyPairDispatcher<TContextData> = (
  contextData: TContextData,
  handle: string,
) => CryptoKeyPair | null | Promise<CryptoKeyPair | null>;

/**
 * A callback that dispatches a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionDispatcher<TItem, TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  cursor: string | null,
) => PageItems<TItem> | null | Promise<PageItems<TItem> | null>;

/**
 * A callback that counts the number of items in a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionCounter<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
) => number | bigint | null | Promise<number | bigint | null>;

/**
 * A callback that returns a cursor for a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionCursor<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
) => string | null | Promise<string | null>;

/**
 * A callback that listens for activities in an inbox.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TActivity The type of activity to listen for.
 */
export type InboxListener<TContextData, TActivity extends Activity> = (
  context: RequestContext<TContextData>,
  activity: TActivity,
) => void | Promise<void>;

/**
 * A callback that handles errors in an inbox.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type InboxErrorHandler<TContextData> = (
  context: RequestContext<TContextData>,
  error: Error,
) => void | Promise<void>;

/**
 * A callback that handles errors during outbox processing.
 *
 * @param error The error that occurred.
 * @param activity The activity that caused the error.  If it is `null`, the
 *                 error occurred during deserializing the activity.
 * @since 0.6.0
 */
export type OutboxErrorHandler = (
  error: Error,
  activity: Activity | null,
) => void | Promise<void>;
