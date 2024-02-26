import { Context } from "../federation/context.ts";
import { Router } from "../federation/router.ts";
import { ActorDispatcher } from "../federation/callback.ts";
import { Link as LinkObject } from "../vocab/mod.ts";
import { Link, ResourceDescriptor } from "./jrd.ts";

export interface WebFingerHandlerParameters<TContextData> {
  router: Router;
  contextData: TContextData;
  actorDispatcher?: ActorDispatcher<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
}

export async function handleWebFinger<TContextData>(
  request: Request,
  {
    router,
    contextData,
    actorDispatcher,
    onNotFound,
  }: WebFingerHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  if (resource == null) {
    return new Response("Missing resource parameter.", { status: 400 });
  }
  const match = /^acct:([^@]+)@([^@]+)$/.exec(resource);
  if (match == null || match[2] != url.host) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const handle = match[1];
  const context = new Context(router, request, contextData);
  const actor = await actorDispatcher(context, handle);
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
    subject: resource,
    aliases: [context.getActorUri(handle).href],
    links,
  };
  return new Response(JSON.stringify(jrd), {
    headers: {
      "Content-Type": "application/jrd+json",
    },
  });
}
