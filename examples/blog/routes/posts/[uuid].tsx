import { Handler, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import Post from "../../components/Post.tsx";
import { Blog, getBlog } from "../../models/blog.ts";
import { getPost, type Post as PostModel } from "../../models/post.ts";

export interface PostPageData {
  domain: string;
  blog: Blog;
  post: PostModel;
}

export const handler: Handler<PostPageData> = async (req, ctx) => {
  const blog = await getBlog();
  if (blog == null) return await ctx.renderNotFound();
  const post = await getPost(ctx.params.uuid);
  if (post == null) return await ctx.renderNotFound();
  const data: PostPageData = { blog, post, domain: ctx.url.host };
  return ctx.render(data);
};

export default function PostPage(
  { data: { domain, blog, post } }: PageProps<PostPageData>,
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
            <strong>@{blog.handle}@{domain}</strong> &middot; {blog.description}
          </p>
        </hgroup>
      </header>
      <Post post={post} />
    </>
  );
}
