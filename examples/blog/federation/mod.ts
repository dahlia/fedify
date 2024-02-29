import { Federation } from "fedify/federation/middleware.ts";
import { isActor } from "fedify/vocab/actor.ts";
import {
  Accept,
  Activity,
  Create,
  Follow,
  Note,
  Person,
  Undo,
} from "fedify/vocab/mod.ts";
import { getBlog } from "../models/blog.ts";
import { openKv } from "../models/kv.ts";
import { countPosts, getPosts } from "../models/post.ts";
import { addFollower } from "fedify/examples/blog/models/follower.ts";
import { Link } from "fedify/vocab/mod.ts";
import { removeFollower } from "fedify/examples/blog/models/follower.ts";

// The `Federation<TContextData>` object is a registry that registers
// federation-related callbacks:
export const federation = new Federation<void>({
  kv: await openKv(),
  treatHttps: true,
});

// Registers the actor dispatcher, which is responsible for creating a
// `Actor` object (`Person` in this case) for a given actor URI.
// The actor dispatch is not only used for the actor URI, but also for
// the WebFinger resource:
federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
  const blog = await getBlog();
  if (blog == null) return null;
  else if (blog.handle !== handle) return null;
  return new Person({
    id: ctx.getActorUri(handle),
    name: blog.title,
    summary: blog.description,
    preferredUsername: handle,
    url: new URL("/", ctx.request.url),
    outbox: ctx.getOutboxUri(handle),
    inbox: ctx.getInboxUri(handle),
    publicKey: key,
  });
})
  .setKeyPairDispatcher(async (_ctxData, handle) => {
    const blog = await getBlog();
    if (blog == null) return null;
    else if (blog.handle !== handle) return null;
    return {
      publicKey: blog.publicKey,
      privateKey: blog.privateKey,
    };
  });

// Registers the outbox dispatcher, which is responsible for listing
// activities in the outbox:
federation.setOutboxDispatcher(
  "/users/{handle}/outbox",
  async (ctx, handle, cursor) => {
    if (cursor == null) return null;
    const blog = await getBlog();
    if (blog == null) return null;
    else if (blog.handle !== handle) return null;
    const activities: Activity[] = [];
    const { posts, nextCursor } = await getPosts(
      undefined,
      // Treat the empty string as the first cursor:
      cursor === "" ? undefined : cursor,
    );
    for await (const post of posts) {
      const activity = new Create({
        actor: ctx.getActorUri(handle),
        object: new Note({
          attributedTo: ctx.getActorUri(handle),
          content: post.content,
          published: post.published,
          url: new URL(`/posts/${post.uuid}`, ctx.request.url),
        }),
      });
      activities.push(activity);
    }
    return {
      items: activities,
      nextCursor,
    };
  },
)
  // Registers the outbox counter, which is responsible for counting the
  // total number of activities in the outbox:
  .setCounter(async (_ctx, handle) => {
    const blog = await getBlog();
    if (blog == null) return null;
    else if (blog.handle !== handle) return null;
    return countPosts();
  })
  // Registers the first cursor.  The cursor value here is arbitrary, but
  // it must be parsable by the outbox dispatcher:
  .setFirstCursor(async (_ctx, handle) => {
    const blog = await getBlog();
    if (blog == null) return null;
    else if (blog.handle !== handle) return null;
    // Treat the empty string as the first cursor:
    return "";
  });

federation.setInboxListeners("/users/{handle}/inbox")
  .on(Follow, async (ctx, follow) => {
    const blog = await getBlog();
    if (blog == null) return;
    if (follow.id == null) return;
    const actorUri = ctx.getActorUri(blog.handle);
    if (follow.objectId?.href != actorUri.href) {
      return;
    }
    const recipient = await follow.getActor(ctx);
    if (
      !isActor(recipient) || recipient.id == null ||
      recipient.preferredUsername == null
    ) return;
    const handle =
      `@${recipient.preferredUsername.toString()}@${recipient.id.host}`;
    await addFollower({
      activityId: follow.id.href,
      id: recipient.id.href,
      name: recipient.name?.toString() ?? "",
      url: recipient.url == null
        ? recipient.id.href
        : recipient.url instanceof Link
        ? (recipient.url.href ?? recipient.id).href
        : recipient.url.href,
      handle,
    });
    await ctx.sendActivity(
      { handle: blog.handle },
      recipient,
      new Accept({
        actor: actorUri,
        object: follow,
      }),
    );
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject(ctx);
    if (object instanceof Follow) {
      if (object.id == null) return;
      await removeFollower(object.id.href);
    } else {
      console.debug(undo);
    }
  })
  .onError((e) => console.error(e));
