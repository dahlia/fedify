import { Handlers, PageProps } from "$fresh/server.ts";
import PostList from "../components/PostList.tsx";
import Setup from "../components/Setup.tsx";
import { getBlog, setBlog } from "../models/blog.ts";
import { countPosts, getPosts } from "../models/post.ts";

export interface HomeData {
  error?: {
    handle?: string;
    title?: string;
    description?: string;
    password?: string;
  };
  defaultValues?: {
    handle?: string;
    title?: string;
    description?: string;
  };
}

export const handler: Handlers<HomeData> = {
  async GET(_req, ctx) {
    return await ctx.render();
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const handle = form.get("handle");
    const title = form.get("title");
    const description = form.get("description");
    const password = form.get("password");
    const error: HomeData["error"] = {};
    if (handle == null || typeof handle !== "string" || handle.trim() === "") {
      error.handle = "Handle is required.";
    } else if (!handle.match(/^[A-Za-z._-]{3,20}$/)) {
      error.handle =
        "Handle must be 3-20 characters long and contain only letters, periods, underscores, and hyphens.";
    }
    if (title == null || typeof title !== "string" || title.trim() === "") {
      error.title = "Title is required.";
    }
    if (
      description == null || typeof description !== "string" ||
      description.trim() === ""
    ) {
      error.description = "Description is required.";
    }
    if (
      password == null || typeof password != "string" || password.trim() === ""
    ) {
      error.password = "Password is required.";
    }
    if (error.handle || error.title || error.description || error.password) {
      return await ctx.render({
        error,
        defaultValues: {
          handle: handle?.toString(),
          title: title?.toString(),
          description: description?.toString(),
        },
      }, { status: 400 });
    }
    await setBlog({
      handle: handle?.toString()!,
      title: title?.toString()!,
      description: description?.toString()!,
      password: password?.toString()!,
    });
    return await ctx.render({}, { status: 201 });
  },
};

export default async function Home(_req: Request, props: PageProps<HomeData>) {
  const blog = await getBlog();
  const { posts, nextCursor } = await getPosts();
  const total = await countPosts();
  return blog == null
    ? (
      <Setup
        url={props.url}
        error={props.data?.error}
        defaultValues={props.data?.defaultValues}
      />
    )
    : (
      <PostList
        blog={blog}
        posts={posts}
        total={total}
        nextCursor={nextCursor}
        domain={props.url.host}
      />
    );
}
