import { getLogger } from "@logtape/logtape";
import { sign } from "../httpsig/mod.ts";
import type { DocumentLoader } from "../runtime/docloader.ts";
import type { Recipient } from "../vocab/actor.ts";
import type { Activity } from "../vocab/mod.ts";

/**
 * Parameters for {@link extractInboxes}.
 */
export interface ExtractInboxesParameters {
  /**
   * Actors to extract the inboxes from.
   */
  recipients: Recipient[];

  /**
   * Whether to prefer the shared inbox over the personal inbox.
   * Defaults to `false`.
   */
  preferSharedInbox?: boolean;
}

/**
 * Extracts the inbox URLs from recipients.
 * @param parameters The parameters to extract the inboxes.
 *                   See also {@link ExtractInboxesParameters}.
 * @returns The inboxes as a map of inbox URL to actor URIs.
 */
export function extractInboxes(
  { recipients, preferSharedInbox }: ExtractInboxesParameters,
): Record<string, Set<string>> {
  const inboxes: Record<string, Set<string>> = {};
  for (const recipient of recipients) {
    const inbox = preferSharedInbox
      ? recipient.endpoints?.sharedInbox ?? recipient.inboxId
      : recipient.inboxId;
    if (inbox != null && recipient.id != null) {
      inboxes[inbox.href] ??= new Set();
      inboxes[inbox.href].add(recipient.id.href);
    }
  }
  return inboxes;
}

/**
 * Parameters for {@link sendActivity}.
 */
export interface SendActivityParameters {
  /**
   * The activity to send.
   */
  activity: Activity;

  /**
   * The actor's private key to sign the request.
   */
  privateKey: CryptoKey;

  /**
   * The public key ID that corresponds to the private key.
   */
  keyId: URL;

  /**
   * The inbox URL to send the activity to.
   */
  inbox: URL;

  /**
   * The context loader to use for JSON-LD context retrieval.
   * @since 0.8.0
   */
  contextLoader?: DocumentLoader;

  /**
   * Additional headers to include in the request.
   */
  headers?: Headers;
}

/**
 * Sends an {@link Activity} to an inbox.
 *
 * @param parameters The parameters for sending the activity.
 *                   See also {@link SendActivityParameters}.
 * @throws {Error} If the activity fails to send.
 */
export async function sendActivity(
  {
    activity,
    privateKey,
    keyId,
    inbox,
    contextLoader,
    headers,
  }: SendActivityParameters,
): Promise<void> {
  const logger = getLogger(["fedify", "federation", "outbox"]);
  if (activity.actorId == null) {
    throw new TypeError(
      "The activity to send must have at least one actor property.",
    );
  }
  const jsonLd = await activity.toJsonLd({ contextLoader });
  headers = new Headers(headers);
  headers.set("Content-Type", "application/activity+json");
  let request = new Request(inbox, {
    method: "POST",
    headers,
    body: JSON.stringify(jsonLd),
  });
  request = await sign(request, privateKey, keyId);
  const response = await fetch(request);
  if (!response.ok) {
    let error;
    try {
      error = await response.text();
    } catch (_) {
      error = "";
    }
    logger.error(
      "Failed to send activity {activityId} to {inbox} ({status} " +
        "{statusText}):\n{error}",
      {
        activityId: activity.id?.href,
        inbox: inbox.href,
        status: response.status,
        statusText: response.statusText,
        error,
      },
    );
    throw new Error(
      `Failed to send activity ${activity?.id?.href} to ${inbox.href} ` +
        `(${response.status} ${response.statusText}):\n${error}`,
    );
  }
}
