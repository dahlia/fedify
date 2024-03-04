import { Head } from "$fresh/runtime.ts";
import { getBlog } from "../models/blog.ts";
import { countFollowers, getFollowers } from "../models/follower.ts";

export default async function FollowerList(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const blog = await getBlog();
  const totalFollowers = await countFollowers();
  const { followers, nextCursor } = await getFollowers(undefined, cursor);
  const domain = url.host;
  if (blog == null) return <p>The blog is not set up yet.</p>;
  return (
    <>
      <Head>
        <title>{blog.title}</title>
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
            {totalFollowers === 1n
              ? "1 follower"
              : `${totalFollowers} followers`} &middot; {blog.description}
          </p>
        </hgroup>
      </header>
      {followers.map((follower) => (
        <article>
          <h2>
            <a href={follower.url}>{follower.name}</a>
          </h2>
          <p>
            <a href={follower.url}>{follower.handle}</a>
          </p>
        </article>
      ))}
      <p style="text-align: center;">
        {nextCursor == null
          ? "No more followers."
          : <a href={`?cursor=${nextCursor}`}>More followers</a>}
      </p>
    </>
  );
}
