import { getLogger } from "@logtape/logtape";
import { signRequest } from "../sig/http.ts";
import type { Recipient } from "../vocab/actor.ts";

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

  /**
   * The base URIs to exclude from the recipients' inboxes.  It is useful
   * for excluding the recipients having the same shared inbox with the sender.
   *
   * Note that the only `origin` parts of the `URL`s are compared.
   *
   * @since 0.9.0
   */
  excludeBaseUris?: URL[];
}

/**
 * Extracts the inbox URLs from recipients.
 * @param parameters The parameters to extract the inboxes.
 *                   See also {@link ExtractInboxesParameters}.
 * @returns The inboxes as a map of inbox URL to actor URIs.
 */
export function extractInboxes(
  { recipients, preferSharedInbox, excludeBaseUris }: ExtractInboxesParameters,
): Record<string, Set<string>> {
  const inboxes: Record<string, Set<string>> = {};
  for (const recipient of recipients) {
    const inbox = preferSharedInbox
      ? recipient.endpoints?.sharedInbox ?? recipient.inboxId
      : recipient.inboxId;
    if (inbox != null && recipient.id != null) {
      if (
        excludeBaseUris != null &&
        excludeBaseUris.some((u) => u.origin == inbox.origin)
      ) {
        continue;
      }
      inboxes[inbox.href] ??= new Set();
      inboxes[inbox.href].add(recipient.id.href);
    }
  }
  return inboxes;
}

/**
 * A key pair for an actor who sends an activity.
 * @since 0.10.0
 */
export interface SenderKeyPair {
  /**
   * The actor's private key to sign the request.
   */
  privateKey: CryptoKey;

  /**
   * The public key ID that corresponds to the private key.
   */
  keyId: URL;
}

/**
 * Parameters for {@link sendActivity}.
 */
export interface SendActivityParameters {
  /**
   * The activity to send.
   */
  activity: unknown;

  /**
   * The activity ID to send.
   * @since 1.0.0
   */
  activityId?: string | null;

  /**
   * The key pairs of the sender to sign the request.  It must not be empty.
   * @since 0.10.0
   */
  keys: SenderKeyPair[];

  /**
   * The inbox URL to send the activity to.
   */
  inbox: URL;

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
    activityId,
    keys,
    inbox,
    headers,
  }: SendActivityParameters,
): Promise<void> {
  const logger = getLogger(["fedify", "federation", "outbox"]);
  headers = new Headers(headers);
  headers.set("Content-Type", "application/activity+json");
  let request = new Request(inbox, {
    method: "POST",
    headers,
    body: JSON.stringify(activity),
  });
  let rsaKey: SenderKeyPair | null = null;
  for (const key of keys) {
    if (key.privateKey.algorithm.name === "RSASSA-PKCS1-v1_5") {
      rsaKey = key;
      break;
    }
  }
  if (rsaKey == null) {
    logger.warn(
      "No supported key found to sign the request to {inbox}.  " +
        "The request will be sent without a signature.  " +
        "In order to sign the request, at least one RSASSA-PKCS1-v1_5 key " +
        "must be provided.",
      {
        inbox: inbox.href,
        keys: keys.map((pair) => ({
          keyId: pair.keyId.href,
          privateKey: pair.privateKey,
        })),
      },
    );
  } else {
    request = await signRequest(request, rsaKey.privateKey, rsaKey.keyId);
  }
  let response: Response;
  try {
    response = await fetch(request);
  } catch (error) {
    logger.error(
      "Failed to send activity {activityId} to {inbox}:\n{error}",
      {
        activityId,
        inbox: inbox.href,
        error,
      },
    );
    throw error;
  }
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
        activityId,
        inbox: inbox.href,
        status: response.status,
        statusText: response.statusText,
        error,
      },
    );
    throw new Error(
      `Failed to send activity ${activityId} to ${inbox.href} ` +
        `(${response.status} ${response.statusText}):\n${error}`,
    );
  }
}
