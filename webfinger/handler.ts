import { RequestContext } from "../federation/context.ts";
import { ActorDispatcher } from "../federation/callback.ts";
import { Router } from "../federation/router.ts";
import { Link as LinkObject } from "../vocab/mod.ts";
import { Link, ResourceDescriptor } from "./jrd.ts";

export interface WebFingerHandlerParameters<TContextData> {
  context: RequestContext<TContextData>;
  router: Router;
  actorDispatcher?: ActorDispatcher<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
}

export async function handleWebFinger<TContextData>(
  request: Request,
  {
    context,
    router,
    actorDispatcher,
    onNotFound,
  }: WebFingerHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const resource = context.url.searchParams.get("resource");
  if (resource == null) {
    return new Response("Missing resource parameter.", { status: 400 });
  }
  let resourceUrl: URL;
  try {
    resourceUrl = new URL(resource);
  } catch (e) {
    if (e instanceof TypeError) {
      return new Response("Invalid resource URL.", { status: 400 });
    }
    throw new e();
  }
  let handle: string | null = null;
  if (resourceUrl.origin === context.url.origin) {
    const route = router.route(resourceUrl.pathname);
    if (route != null && route.name === "actor") {
      handle = route.values.handle;
    }
  }
  if (handle == null) {
    const match = /^acct:([^@]+)@([^@]+)$/.exec(resource);
    if (match == null || match[2] != context.url.host) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    handle = match[1];
  }
  const key = await context.getActorKey(handle);
  const actor = await actorDispatcher(context, handle, key);
  if (actor == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const links: Link[] = [
    {
      rel: "self",
      href: context.getActorUri(handle).href,
      type: "application/activity+json",
    },
  ];
  for (const url of actor.urls) {
    if (url instanceof LinkObject && url.href != null) {
      links.push({
        rel: url.rel ?? "http://webfinger.net/rel/profile-page",
        href: url.href.href,
        type: url.mediaType == null ? undefined : url.mediaType,
      });
    } else if (url instanceof URL) {
      links.push({
        rel: "http://webfinger.net/rel/profile-page",
        href: url.href,
        type: "application/activity+json",
      });
    }
  }
  const jrd: ResourceDescriptor = {
    subject: `acct:${handle}@${context.url.host}`,
    aliases: [context.getActorUri(handle).href],
    links,
  };
  return new Response(JSON.stringify(jrd), {
    headers: {
      "Content-Type": "application/jrd+json",
    },
  });
}
