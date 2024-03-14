import {
  Actor,
  ActorTypeName,
  Endpoints,
  getActorClassByTypeName,
} from "@fedify/fedify/vocab";
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

export async function removeFollower(activityId: string): Promise<void> {
  const kv = await openKv();
  const follower = await kv.get<Follower>(["follower", activityId]);
  const followers = await kv.get<bigint>(["followers"]);
  if (
    follower == null || follower.value == null || followers == null ||
    followers.value == null
  ) return;
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

export async function getFollowersAsActors(): Promise<Actor[]> {
  const kv = await openKv();
  const actors: Actor[] = [];
  for await (const f of kv.list<Follower>({ prefix: ["follower"] })) {
    const cls = getActorClassByTypeName(f.value.typeName);
    const actor = new cls({
      id: new URL(f.value.id),
      inbox: new URL(f.value.inbox),
      endpoints: new Endpoints({
        sharedInbox: f.value.sharedInbox
          ? new URL(f.value.sharedInbox)
          : undefined,
      }),
    });
    actors.push(actor);
  }
  return actors;
}
