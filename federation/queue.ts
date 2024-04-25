export interface OutboxMessage {
  type: "outbox";
  keyId: string;
  privateKey: JsonWebKey;
  activity: unknown;
  inbox: string;
  trial: number;
  headers: Record<string, string>;
}
