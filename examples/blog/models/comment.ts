import sanitizeHtml from "sanitize-html";
import { Temporal } from "@js-temporal/polyfill";
import { openKv } from "./kv.ts";

export interface Comment {
  postUuid: string;
  id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    url: string;
  };
  content: string;
  url: string;
  published: Temporal.Instant;
}

export async function addComment(comment: Comment): Promise<Comment> {
  const kv = await openKv();
  await kv.set(["comment", comment.postUuid, comment.id], {
    ...comment,
    published: comment.published.toString(),
  });
  return comment;
}

export async function getComments(postUuid: string): Promise<Comment[]> {
  const kv = await openKv();
  const it = kv.list<Comment>({ prefix: ["comment", postUuid] });
  const comments: Comment[] = [];
  for await (const entry of it) {
    comments.push({
      ...entry.value,
      published: Temporal.Instant.from(entry.value.published),
    });
  }
  return comments;
}

export function getContentHtml(comment: Comment): string {
  return sanitizeHtml(comment.content);
}
