import {
  type Comment as CommentModel,
  getContentHtml,
} from "../models/comment.ts";

interface CommentProps {
  comment: CommentModel;
}

export default function Comment({ comment }: CommentProps) {
  return (
    <article>
      <header>
        <hgroup>
          <h3>
            Re: <a href={comment.author.url}>{comment.author.name}</a>
          </h3>
          <p>
            {comment.author.handle} &middot;{" "}
            <a href={comment.url}>
              <time datetime={comment.published.toString()}>
                {comment.published.toLocaleString()}
              </time>
            </a>
          </p>
        </hgroup>
      </header>
      <div dangerouslySetInnerHTML={{ __html: getContentHtml(comment) }} />
    </article>
  );
}
