export interface SenderKeyJwkPair {
  keyId: string;
  privateKey: JsonWebKey;
}

export interface OutboxMessage {
  type: "outbox";
  keys: SenderKeyJwkPair[];
  activity: unknown;
  inbox: string;
  trial: number;
  headers: Record<string, string>;
}
