import { Handler, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { respondWithObjectIfAcceptable } from "@fedify/fedify/federation";
import Comment from "../../components/Comment.tsx";
import Post from "../../components/Post.tsx";
import { federation } from "../../federation/mod.ts";
import { Blog, getBlog } from "../../models/blog.ts";
import {
  type Comment as CommentModel,
  getComments,
} from "../../models/comment.ts";
import {
  getPost,
  type Post as PostModel,
  toArticle,
} from "../../models/post.ts";
import { countFollowers } from "../../models/follower.ts";

export interface PostPageData {
  domain: string;
  blog: Blog;
  post: PostModel;
  comments: CommentModel[];
  followers: bigint;
}

export const handler: Handler<PostPageData> = async (req, ctx) => {
  const blog = await getBlog();
  if (blog == null) return await ctx.renderNotFound();
  const post = await getPost(ctx.params.uuid);
  if (post == null) return await ctx.renderNotFound();
  const comments = await getComments(post.uuid);
  const fedCtx = federation.createContext(req);
  const article = toArticle(fedCtx, blog, post, comments);
  const response = await respondWithObjectIfAcceptable(article, req, fedCtx);
  if (response != null) return response;

  const followers = await countFollowers();
  const data: PostPageData = {
    blog,
    post,
    domain: ctx.url.host,
    comments,
    followers,
  };
  return ctx.render(data);
};

export default function PostPage(
  { data: { domain, blog, post, comments, followers } }: PageProps<
    PostPageData
  >,
) {
  return (
    <>
      <Head>
        <title>{post.title} &mdash; {blog.title}</title>
      </Head>
      <header>
        <hgroup>
          <h1>
            <a href="/">{blog.title}</a>
          </h1>
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
      <Post post={post} />
      {comments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
        />
      ))}
    </>
  );
}
