import { getContentHtml, type Post as PostModel } from "../models/post.ts";

interface PostProps {
  post: PostModel;
}

export default function Post({ post }: PostProps) {
  return (
    <article>
      <header>
        <hgroup>
          <h2>
            <a href={`/posts/${post.uuid}`}>{post.title}</a>
          </h2>
          <p>
            <time datetime={post.published.toString()}>
              {post.published.toLocaleString()}
            </time>
          </p>
        </hgroup>
      </header>
      <div dangerouslySetInnerHTML={{ __html: getContentHtml(post) }} />
    </article>
  );
}
