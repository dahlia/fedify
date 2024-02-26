import markdownIt from "markdown-it";
import { uuidv7 } from "uuidv7";
import { openKv } from "./kv.ts";

export interface Post {
  uuid: string;
  title: string;
  content: string;
  published: Temporal.Instant;
}

export async function addPost(post: Omit<Post, "uuid"> | Post): Promise<Post> {
  const kv = await openKv();
  let uuid;
  if (!("uuid" in post) || post.uuid == null) {
    uuid = uuidv7();
  } else {
    uuid = post.uuid;
  }
  const newPost = { uuid, ...post, published: post.published.toString() };
  const one = new Deno.KvU64(1n);
  await kv.atomic()
    .set(["post", uuid], newPost)
    .sum(["count"], one.value)
    .commit();
  return { uuid, ...post };
}

export async function getPost(uuid: string): Promise<Post | null> {
  const kv = await openKv();
  const post = await kv.get<Post>(["post", uuid]);
  if (post?.value == null) return null;
  return {
    ...post.value,
    published: Temporal.Instant.from(post.value.published),
  };
}

export async function getPosts(
  limit = 5,
  cursor?: string,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const kv = await openKv();
  const it = kv.list<Post>({ prefix: ["post"] }, {
    limit,
    cursor,
    reverse: true,
  });
  const posts: Post[] = [];
  for await (const entry of it) {
    posts.push({
      ...entry.value,
      published: Temporal.Instant.from(entry.value.published),
    });
  }
  return { posts, nextCursor: posts.length < limit ? null : it.cursor };
}

export async function countPosts(): Promise<bigint> {
  const kv = await openKv();
  const record = await kv.get(["count"]);
  return (record.value as bigint | null) ?? 0n;
}

export function getContentHtml(post: Post): string {
  const md = markdownIt();
  return md.render(post.content);
}
