import { ActorTypeName, Recipient } from "@fedify/fedify/vocab";
import { openKv } from "./kv.ts";

export interface Follower {
  activityId: string;
  id: string;
  name: string;
  url: string;
  handle: string;
  inbox: string;
  sharedInbox?: string;
  typeName: ActorTypeName;
}

export async function addFollower(follower: Follower): Promise<Follower> {
  const kv = await openKv();
  const followers = await kv.get<bigint>(["followers"]);
  await kv.atomic()
    .check(followers)
    .set(["follower", follower.activityId], follower)
    .set(["followers"], (followers.value ?? 0n) + 1n)
    .commit();
  return follower;
}

export async function removeFollower(
  activityId: string,
  actorId: string,
): Promise<void> {
  const kv = await openKv();
  const follower = await kv.get<Follower>(["follower", activityId]);
  const followers = await kv.get<bigint>(["followers"]);
  if (
    follower == null || follower.value == null || followers == null ||
    followers.value == null
  ) {
    // Sometimes Follow.id and Undo<Follow>.object.id do not match...
    // (e.g., Misskey)
    for await (const entry of kv.list<Follower>({ prefix: ["follower"] })) {
      if (entry.value.id === actorId) {
        const followers = await kv.get<bigint>(["followers"]);
        if (followers == null || followers.value == null) continue;
        await kv.atomic()
          .check(follower)
          .check(followers)
          .delete(entry.key)
          .set(["followers"], followers.value - 1n)
          .commit();
      }
    }
    return;
  }
  await kv.atomic()
    .check(follower)
    .check(followers)
    .delete(["follower", activityId])
    .set(["followers"], followers.value - 1n)
    .commit();
}

export async function getFollowers(
  limit = 5,
  cursor?: string,
): Promise<{ followers: Follower[]; nextCursor: string | null }> {
  const kv = await openKv();
  const it = kv.list<Follower>({ prefix: ["follower"] }, {
    limit,
    cursor,
  });
  const followers: Follower[] = [];
  for await (const entry of it) {
    followers.push(entry.value);
  }
  return { followers, nextCursor: followers.length < limit ? null : it.cursor };
}

export async function countFollowers(): Promise<bigint> {
  const kv = await openKv();
  const record = await kv.get(["followers"]);
  return (record?.value as bigint | null) ?? 0n;
}

export function toRecipient(follower: Follower): Recipient {
  return {
    id: new URL(follower.id),
    inboxId: new URL(follower.inbox),
    endpoints: {
      sharedInbox: follower.sharedInbox ? new URL(follower.sharedInbox) : null,
    },
  };
}
