import { Federation, MemoryKvStore } from "@fedify/fedify/federation";
import { Person } from "@fedify/fedify/vocab";
import { federation } from "@fedify/fedify/x/hono";
import { Hono } from "hono";

const fedi = new Federation<void>({
  kv: new MemoryKvStore(),
});

fedi.setActorDispatcher("/{handle}", (ctx, handle, _key) => {
  if (handle !== "sample") return null;
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Sample",
    preferredUsername: handle,
  });
});

const app = new Hono();
app.use(federation(fedi, () => undefined));
app.get("/", (c) => c.redirect("/sample"));
app.get("/sample", (c) => c.text("Hi, I am Sample!\n"));

if (import.meta.main) Deno.serve(app.fetch.bind(app));

export default app;
