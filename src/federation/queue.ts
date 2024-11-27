export interface SenderKeyJwkPair {
  keyId: string;
  privateKey: JsonWebKey;
}

export type Message = OutboxMessage | InboxMessage;

export interface OutboxMessage {
  type: "outbox";
  id: ReturnType<typeof crypto.randomUUID>;
  keys: SenderKeyJwkPair[];
  activity: unknown;
  activityId?: string;
  activityType: string;
  inbox: string;
  sharedInbox: boolean;
  started: string;
  attempt: number;
  headers: Record<string, string>;
}

export interface InboxMessage {
  type: "inbox";
  id: ReturnType<typeof crypto.randomUUID>;
  baseUrl: string;
  activity: unknown;
  started: string;
  attempt: number;
  identifier: string | null;
}
