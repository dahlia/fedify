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
  trial: number;
  headers: Record<string, string>;
}

export interface InboxMessage {
  type: "inbox";
  baseUrl: string;
  activity: unknown;
  handle: string | null;
}
