import type { NodeInfo } from "../nodeinfo/types.ts";
import type { Actor } from "../vocab/actor.ts";
import type { Activity, CryptographicKey } from "../vocab/mod.ts";
import type { Object } from "../vocab/vocab.ts";
import type { PageItems } from "./collection.ts";
import type { Context, RequestContext } from "./context.ts";
import type { SenderKeyPair } from "./send.ts";

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
 * @param context The request context.
 * @param handle The actor's handle.
 * @param key The public key of the actor.  **Deprecated: Do not rely on this
 *            parameter. Instead, use the {@link Context.getActorKeyPairs}
 *            method.**
 */
export type ActorDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  key: CryptographicKey | null,
) => Actor | null | Promise<Actor | null>;

/**
 * A callback that dispatches key pairs for an actor.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The context.
 * @param handle The actor's handle.
 * @returns The key pairs.
 * @since 0.10.0
 */
export type ActorKeyPairsDispatcher<TContextData> = (
  context: Context<TContextData>,
  handle: string,
) => CryptoKeyPair[] | Promise<CryptoKeyPair[]>;

/**
 * A callback that dispatches a key pair for an actor.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @deprecated
 */
export type ActorKeyPairDispatcher<TContextData> = (
  contextData: TContextData,
  handle: string,
) => CryptoKeyPair | null | Promise<CryptoKeyPair | null>;

/**
 * A callback that dispatches an object.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TObject The type of object to dispatch.
 * @typeParam TParam The parameter names of the requested URL.
 * @since 0.7.0
 */
export type ObjectDispatcher<
  TContextData,
  TObject extends Object,
  TParam extends string,
> = (
  context: RequestContext<TContextData>,
  values: Record<TParam, string>,
) => TObject | null | Promise<TObject | null>;

/**
 * A callback that dispatches a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionDispatcher<TItem, TContextData, TFilter> = (
  context: RequestContext<TContextData>,
  handle: string,
  cursor: string | null,
  filter?: TFilter,
) => PageItems<TItem> | null | Promise<PageItems<TItem> | null>;

/**
 * A callback that counts the number of items in a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionCounter<TContextData, TFilter> = (
  context: RequestContext<TContextData>,
  handle: string,
  filter?: TFilter,
) => number | bigint | null | Promise<number | bigint | null>;

/**
 * A callback that returns a cursor for a collection.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 */
export type CollectionCursor<TContextData, TFilter> = (
  context: RequestContext<TContextData>,
  handle: string,
  filter?: TFilter,
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
 * A callback that dispatches the key pair for the authenticated document loader
 * of the {@link Context} passed to the shared inbox listener.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The request context.
 * @returns The handle of the actor or the key pair for the authenticated
 *          document loader of the {@link Context} passed to the shared inbox
 *          listener.  If `null` is returned, the request is not authorized.
 * @since 0.11.0
 */
export type SharedInboxKeyDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
) =>
  | SenderKeyPair
  | { handle: string }
  | null
  | Promise<SenderKeyPair | { handle: string } | null>;

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

/**
 * A callback that determines if a request is authorized or not.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The request context.
 * @param handle The handle of the actor that is being requested.
 * @param signedKey The key that was used to sign the request, or `null` if
 *                  the request was not signed or the signature was invalid.
 * @param signedKeyOwner The actor that owns the key that was used to sign the
 *                       request, or `null` if the request was not signed or the
 *                       signature was invalid, or if the key is not associated
 *                       with an actor.
 * @returns `true` if the request is authorized, `false` otherwise.
 * @since 0.7.0
 */
export type AuthorizePredicate<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
  signedKey: CryptographicKey | null,
  signedKeyOwner: Actor | null,
) => boolean | Promise<boolean>;

/**
 * A callback that determines if a request is authorized or not.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TParam The parameter names of the requested URL.
 * @param context The request context.
 * @param values The parameters of the requested URL.
 * @param signedKey The key that was used to sign the request, or `null` if
 *                  the request was not signed or the signature was invalid.
 * @param signedKeyOwner The actor that owns the key that was used to sign the
 *                       request, or `null` if the request was not signed or the
 *                       signature was invalid, or if the key is not associated
 *                       with an actor.
 * @returns `true` if the request is authorized, `false` otherwise.
 * @since 0.7.0
 */
export type ObjectAuthorizePredicate<TContextData, TParam extends string> = (
  context: RequestContext<TContextData>,
  values: Record<TParam, string>,
  signedKey: CryptographicKey | null,
  signedKeyOwner: Actor | null,
) => boolean | Promise<boolean>;
