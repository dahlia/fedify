import { getContentHtml, type Post as PostModel } from "../models/post.ts";

interface PostProps {
  post: PostModel;
}

export default function Post({ post }: PostProps) {
  return (
    <article>
      <hgroup>
        <h1>
          <a href={`/posts/${post.uuid}`}>{post.title}</a>
        </h1>
        <p>
          <time datetime={post.published.toString()}>
            {post.published.toLocaleString()}
          </time>
        </p>
      </hgroup>
      <div dangerouslySetInnerHTML={{ __html: getContentHtml(post) }} />
    </article>
  );
}
