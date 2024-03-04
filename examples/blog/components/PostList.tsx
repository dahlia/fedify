import { Head } from "$fresh/runtime.ts";
import { type Blog } from "../models/blog.ts";
import { type Post as PostModel } from "../models/post.ts";
import Post from "./Post.tsx";
import { PostForm, PostFormProps } from "./PostForm.tsx";

export interface PostListProps extends PostFormProps {
  blog: Blog;
  posts: PostModel[];
  total: bigint;
  followers: bigint;
  nextCursor: string | null;
  domain: string;
}

export default function PostList(
  {
    blog,
    posts,
    total,
    followers,
    nextCursor,
    domain,
    error,
    defaultValues,
  }: PostListProps,
) {
  return (
    <>
      <Head>
        <title>{blog.title}</title>
      </Head>
      <header>
        <hgroup>
          <h1>{blog.title}</h1>
          <p>
            <strong style="user-select: all; cursor: text;">
              @{blog.handle}@{domain}
            </strong>{" "}
            &middot;{" "}
            <a href="/followers">
              {followers === 1n ? "1 follower" : `${followers} followers`}
            </a>{" "}
            &middot; {blog.description}
          </p>
        </hgroup>
      </header>
      <PostForm
        method="post"
        action="/posts/"
        error={error}
        defaultValues={defaultValues}
      />
      <div>
        {posts.map((post) => <Post key={post.uuid} post={post} />)}
      </div>
      <p style="text-align: center;">
        {nextCursor
          ? <a href={`/posts?cursor=${nextCursor}`}>More posts&hellip;</a>
          : "No more posts."} (Total {total.toString()} posts.)
      </p>
    </>
  );
}
