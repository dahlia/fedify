import { assertEquals, assertThrows } from "@std/assert";
import { test } from "../testing/mod.ts";
import { Router, RouterError, type RouterOptions } from "./router.ts";

function setUp(options: RouterOptions = {}): Router {
  const router = new Router(options);
  router.add("/users/{name}", "user");
  router.add(
    "/users/{name}/posts/{postId}" +
      (options.trailingSlashInsensitive ? "/" : ""),
    "post",
  );
  return router;
}

test("Router.add()", () => {
  const router = new Router();
  assertEquals(router.add("/users", "users"), new Set());
  assertEquals(router.add("/users/{name}", "user"), new Set(["name"]));
  assertEquals(
    router.add("/users/{name}/posts/{postId}", "post"),
    new Set([
      "name",
      "postId",
    ]),
  );
  assertThrows(() => router.add("foo", "name"), RouterError);
});

test("Router.route()", () => {
  let router = setUp();
  assertEquals(router.route("/users/alice"), {
    name: "user",
    values: { name: "alice" },
  });
  assertEquals(router.route("/users/bob/"), null);
  assertEquals(router.route("/users/alice/posts/123"), {
    name: "post",
    values: { name: "alice", postId: "123" },
  });
  assertEquals(router.route("/users/bob/posts/456/"), null);

  router = setUp({ trailingSlashInsensitive: true });
  assertEquals(router.route("/users/alice"), {
    name: "user",
    values: { name: "alice" },
  });
  assertEquals(router.route("/users/bob/"), {
    name: "user",
    values: { name: "bob" },
  });
  assertEquals(router.route("/users/alice/posts/123"), {
    name: "post",
    values: { name: "alice", postId: "123" },
  });
  assertEquals(router.route("/users/bob/posts/456/"), {
    name: "post",
    values: { name: "bob", postId: "456" },
  });
});

test("Router.build()", () => {
  const router = setUp();
  assertEquals(router.build("user", { name: "alice" }), "/users/alice");
  assertEquals(
    router.build("post", { name: "alice", postId: "123" }),
    "/users/alice/posts/123",
  );
});
