import { JSX } from "preact";

export interface PostFormProps {
  error?: {
    title?: string;
    content?: string;
    password?: string;
  };
  defaultValues?: {
    title?: string;
    content?: string;
  };
}

export function PostForm(
  attrs: PostFormProps & JSX.HTMLAttributes<HTMLFormElement>,
) {
  const { error, defaultValues } = attrs;
  return (
    <form {...attrs}>
      <fieldset>
        <label for="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          required={true}
          aria-invalid={error?.title == null ? undefined : "true"}
          value={defaultValues?.title}
        />
        {error?.title && (
          <small>
            <strong>{error.title}</strong>
          </small>
        )}
      </fieldset>
      <fieldset>
        <label for="content">Content</label>
        <textarea
          id="content"
          name="content"
          cols={80}
          rows={7}
          required={true}
          aria-invalid={error?.content == null ? undefined : "true"}
          value={defaultValues?.content}
        />
        {error?.content && (
          <small>
            <strong>{error.content}</strong>
          </small>
        )}
      </fieldset>
      <fieldset>
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          required={true}
          aria-invalid={error?.password == null ? undefined : "true"}
        />
        {error?.password && (
          <small>
            <strong>{error.password}</strong>
          </small>
        )}
      </fieldset>
      <button type="submit">Post</button>
    </form>
  );
}

export default PostForm;
