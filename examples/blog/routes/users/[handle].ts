import { Handler } from "$fresh/server.ts";
import { getBlog } from "../../models/blog.ts";

export const handler: Handler = async (_req, ctx) => {
  const blog = await getBlog();
  if (blog == null) return await ctx.renderNotFound();
  if (ctx.params.handle !== blog.handle) return await ctx.renderNotFound();
  return Response.redirect(new URL("/", ctx.url), 301);
};
