export interface SenderKeyJwkPair {
  keyId: string;
  privateKey: JsonWebKey;
}

export type Message = OutboxMessage | InboxMessage;

export interface OutboxMessage {
  type: "outbox";
  keys: SenderKeyJwkPair[];
  activity: unknown;
  inbox: string;
  started: string;
  attempt: number;
  headers: Record<string, string>;
}

export interface InboxMessage {
  type: "inbox";
  baseUrl: string;
  activity: unknown;
  started: string;
  attempt: number;
  handle: string | null;
}
