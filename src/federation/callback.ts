import type { NodeInfo } from "../nodeinfo/types.ts";
import type { Actor } from "../vocab/actor.ts";
import type { Activity, CryptographicKey } from "../vocab/mod.ts";
import type { Object } from "../vocab/vocab.ts";
import type { PageItems } from "./collection.ts";
import type { Context, InboxContext, RequestContext } from "./context.ts";
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
 */
export type ActorDispatcher<TContextData> = (
  context: RequestContext<TContextData>,
  handle: string,
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
 * A callback that maps a WebFinger username to the corresponding actor's
 * internal handle, or `null` if the username is not found.
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The context.
 * @param username The WebFinger username.
 * @since 0.15.0
 */
export type ActorHandleMapper<TContextData> = (
  context: Context<TContextData>,
  username: string,
) => string | null | Promise<string | null>;

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
 * @typeParam TItem The type of items in the collection.
 * @typeParam TContext The type of the context. {@link Context} or
 *                     {@link RequestContext}.
 * @typeParam TContextData The context data to pass to the `TContext`.
 * @typeParam TFilter The type of the filter, if any.
 * @param context The context.
 * @param handle The handle of the collection owner.
 * @param cursor The cursor to start the collection from, or `null` to dispatch
 *               the entire collection without pagination.
 * @param filter The filter to apply to the collection, if any.
 */
export type CollectionDispatcher<
  TItem,
  TContext extends Context<TContextData>,
  TContextData,
  TFilter,
> = (
  context: TContext,
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
 * @typeParam TContext The type of the context. {@link Context} or
 *                     {@link RequestContext}.
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TFilter The type of the filter, if any.
 * @param context The context.
 * @param handle The handle of the collection owner.
 * @param filter The filter to apply to the collection, if any.
 */
export type CollectionCursor<
  TContext extends Context<TContextData>,
  TContextData,
  TFilter,
> = (
  context: TContext,
  handle: string,
  filter?: TFilter,
) => string | null | Promise<string | null>;

/**
 * A callback that listens for activities in an inbox.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TActivity The type of activity to listen for.
 * @param context The inbox context.
 * @param activity The activity that was received.
 */
export type InboxListener<TContextData, TActivity extends Activity> = (
  context: InboxContext<TContextData>,
  activity: TActivity,
) => void | Promise<void>;

/**
 * A callback that handles errors in an inbox.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The inbox context.
 */
export type InboxErrorHandler<TContextData> = (
  context: Context<TContextData>,
  error: Error,
) => void | Promise<void>;

/**
 * A callback that dispatches the key pair for the authenticated document loader
 * of the {@link Context} passed to the shared inbox listener.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @param context The context.
 * @returns The handle of the actor or the key pair for the authenticated
 *          document loader of the {@link Context} passed to the shared inbox
 *          listener.  If `null` is returned, the request is not authorized.
 * @since 0.11.0
 */
export type SharedInboxKeyDispatcher<TContextData> = (
  context: Context<TContextData>,
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
