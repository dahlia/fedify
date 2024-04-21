import { Temporal } from "@js-temporal/polyfill";
import { Handlers, PageProps } from "$fresh/server.ts";
import { Create } from "@fedify/fedify/vocab";
import { PostFormProps } from "../../components/PostForm.tsx";
import PostList from "../../components/PostList.tsx";
import { federation } from "../../federation/mod.ts";
import { Blog, getBlog, verifyPassword } from "../../models/blog.ts";
import { countFollowers, getFollowersAsActors } from "../../models/follower.ts";
import {
  addPost,
  countPosts,
  getPosts,
  Post,
  toArticle,
} from "../../models/post.ts";

interface PostsData extends PostFormProps {
  blog: Blog;
  posts: Post[];
  total: bigint;
  followers: bigint;
  nextCursor: string | null;
}

export const handler: Handlers<PostsData> = {
  async GET(_req, ctx) {
    const cursor = ctx.url.searchParams.get("cursor");
    const blog = await getBlog();
    if (blog == null) return await ctx.renderNotFound();
    const { posts, nextCursor } = await getPosts(
      undefined,
      cursor ?? undefined,
    );
    const total = await countPosts();
    const followers = await countFollowers();
    return await ctx.render({ blog, posts, total, followers, nextCursor });
  },

  async POST(req, ctx) {
    const blog = await getBlog();
    if (blog == null) return await ctx.renderNotFound();

    const form = await req.formData();
    let title = form.get("title");
    let content = form.get("content");
    const password = form.get("password");
    const error: PostsData["error"] = {};
    if (title == null || typeof title !== "string" || title.trim() === "") {
      error.title = "Title is required.";
      title = title?.toString() ?? "";
    }
    if (
      content == null || typeof content !== "string" || content.trim() === ""
    ) {
      error.content = "Content is required.";
      content = content?.toString() ?? "";
    }
    if (
      password == null || typeof password !== "string" || password.trim() === ""
    ) {
      error.password = "Password is required.";
    } else if (!verifyPassword(blog, password)) {
      error.password = "Incorrect password.";
    }
    if (error.title || error.content || error.password) {
      const { posts, nextCursor } = await getPosts();
      const total = await countPosts();
      const followers = await countFollowers();
      return await ctx.render({
        blog,
        posts,
        total,
        followers,
        nextCursor,
        error,
        defaultValues: { title, content },
      });
    }
    const post = await addPost({
      title,
      content,
      published: Temporal.Now.instant(),
    });
    // Gets a federation context for enqueueing an activity:
    const fedCtx = federation.createContext(req);
    // Enqueues a `Create` activity to the outbox:
    await fedCtx.sendActivity(
      { handle: blog.handle },
      await getFollowersAsActors(),
      new Create({
        id: new URL(`/posts/${post.uuid}#activity`, req.url),
        actor: fedCtx.getActorUri(blog.handle),
        to: new URL("https://www.w3.org/ns/activitystreams#Public"),
        object: toArticle(fedCtx, blog, post, []),
      }),
    );

    const { posts, nextCursor } = await getPosts();
    const total = await countPosts();
    const followers = await countFollowers();
    return await ctx.render({ blog, total, posts, followers, nextCursor }, {
      status: 201,
    });
  },
};

export default function Posts(props: PageProps<PostsData>) {
  const { blog, posts, total, followers, nextCursor, error, defaultValues } =
    props.data;
  return (
    <PostList
      blog={blog}
      posts={posts}
      total={total}
      followers={followers}
      nextCursor={nextCursor}
      domain={props.url.host}
      error={error}
      defaultValues={defaultValues}
    />
  );
}
