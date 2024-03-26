import { Temporal } from "@js-temporal/polyfill";
import { RequestContext } from "@fedify/fedify/federation";
import { Article, Collection, CollectionPage } from "@fedify/fedify/vocab";
import markdownIt from "markdown-it";
import { uuidv7 } from "uuidv7";
import { Blog } from "./blog.ts";
import { Comment } from "./comment.ts";
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
  await kv.atomic()
    .set(["post", uuid], newPost)
    .sum(["count"], 1n)
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

// Represents a post as an ActivityStreams `Article`:
export function toArticle(
  context: RequestContext<void>,
  blog: Blog,
  post: Post,
  comments: Comment[],
): Article {
  const url = new URL(`/posts/${post.uuid}`, context.url);
  return new Article({
    id: url,
    attribution: context.getActorUri(blog.handle),
    to: new URL("https://www.w3.org/ns/activitystreams#Public"),
    summary: post.title,
    content: getContentHtml(post),
    published: post.published,
    url,
    replies: new Collection({
      first: new CollectionPage({
        items: comments.map((c) => new URL(c.id)),
      }),
    }),
  });
}
