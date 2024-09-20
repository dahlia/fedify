import { getLogger } from "@logtape/logtape";
import { toASCII } from "node:punycode";
import type {
  ActorDispatcher,
  ActorHandleMapper,
} from "../federation/callback.ts";
import type { RequestContext } from "../federation/context.ts";
import { Link as LinkObject } from "../vocab/mod.ts";
import type { Link, ResourceDescriptor } from "./jrd.ts";

const logger = getLogger(["fedify", "webfinger", "server"]);

/**
 * Parameters for {@link handleWebFinger}.
 */
export interface WebFingerHandlerParameters<TContextData> {
  /**
   * The request context.
   */
  context: RequestContext<TContextData>;

  /**
   * The callback for dispatching the actor.
   */
  actorDispatcher?: ActorDispatcher<TContextData>;

  /**
   * The callback for mapping a WebFinger username to the corresponding actor's
   * internal handle, or `null` if the username is not found.
   */
  actorHandleMapper?: ActorHandleMapper<TContextData>;

  /**
   * The function to call when the actor is not found.
   */
  onNotFound(request: Request): Response | Promise<Response>;
}

/**
 * Handles a WebFinger request.  You would not typically call this function
 * directly, but instead use {@link Federation.fetch} method.
 * @param request The WebFinger request to handle.
 * @param parameters The parameters for handling the request.
 * @returns The response to the request.
 */
export async function handleWebFinger<TContextData>(
  request: Request,
  {
    context,
    actorDispatcher,
    actorHandleMapper,
    onNotFound,
  }: WebFingerHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) return await onNotFound(request);
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
  if (actorDispatcher == null) {
    logger.error("Actor dispatcher is not set.");
    return await onNotFound(request);
  }
  let identifier: string | null;
  const uriParsed = context.parseUri(resourceUrl);
  if (uriParsed?.type != "actor") {
    const match = /^acct:([^@]+)@([^@]+)$/.exec(resource);
    if (match == null || toASCII(match[2].toLowerCase()) != context.url.host) {
      return await onNotFound(request);
    }
    const username = match[1];
    if (actorHandleMapper == null) {
      logger.error(
        "No actor handle mapper is set; use the WebFinger username {username}" +
          " as the actor's internal identifier.",
        { username },
      );
      identifier = username;
    } else {
      identifier = await actorHandleMapper(context, username);
      if (identifier == null) {
        logger.error("Actor {username} not found.", { username });
        return await onNotFound(request);
      }
    }
    resourceUrl = new URL(`acct:${username}@${context.url.host}`);
  } else {
    identifier = uriParsed.identifier;
  }
  const actor = await actorDispatcher(context, identifier);
  if (actor == null) {
    logger.error("Actor {identifier} not found.", { identifier });
    return await onNotFound(request);
  }
  const links: Link[] = [
    {
      rel: "self",
      href: context.getActorUri(identifier).href,
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
      });
    }
  }
  for await (const image of actor.getIcons()) {
    if (image.url?.href == null) continue;
    const link: Link = {
      rel: "http://webfinger.net/rel/avatar",
      href: image.url.href.toString(),
    };
    if (image.mediaType != null) link.type = image.mediaType;
    links.push(link);
  }
  const jrd: ResourceDescriptor = {
    subject: resourceUrl.href,
    aliases: resourceUrl.href === context.getActorUri(identifier).href
      ? (actor.preferredUsername == null
        ? []
        : [`acct:${actor.preferredUsername}@${context.url.host}`])
      : [context.getActorUri(identifier).href],
    links,
  };
  return new Response(JSON.stringify(jrd), {
    headers: {
      "Content-Type": "application/jrd+json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
