import { getLogger } from "@logtape/logtape";
import type { Context, RequestContext } from "../federation/context.ts";
import { RouterError } from "../federation/router.ts";
import { mockDocumentLoader } from "./docloader.ts";

export function createContext<TContextData>(
  {
    data,
    documentLoader,
    contextLoader,
    getNodeInfoUri,
    getActorUri,
    getObjectUri,
    getOutboxUri,
    getInboxUri,
    getFollowingUri,
    getFollowersUri,
    parseUri,
    getActorKey,
    getDocumentLoader,
    sendActivity,
  }: Partial<Context<TContextData>> & { data: TContextData },
): Context<TContextData> {
  function throwRouteError(): URL {
    throw new RouterError("Not implemented");
  }
  return {
    data,
    documentLoader: documentLoader ?? mockDocumentLoader,
    contextLoader: contextLoader ?? mockDocumentLoader,
    getNodeInfoUri: getNodeInfoUri ?? throwRouteError,
    getActorUri: getActorUri ?? throwRouteError,
    getObjectUri: getObjectUri ?? throwRouteError,
    getOutboxUri: getOutboxUri ?? throwRouteError,
    getInboxUri: getInboxUri ?? throwRouteError,
    getFollowingUri: getFollowingUri ?? throwRouteError,
    getFollowersUri: getFollowersUri ?? throwRouteError,
    parseUri: parseUri ?? ((_uri) => {
      throw new Error("Not implemented");
    }),
    getHandleFromActorUri(actorUri: URL): string | null {
      getLogger(["fedify", "federation"]).warn(
        "Context.getHandleFromActorUri() is deprecated; " +
          "use Context.parseUri() instead.",
      );
      const result = this.parseUri(actorUri);
      if (result?.type === "actor") return result.handle;
      return null;
    },
    getDocumentLoader: getDocumentLoader ?? ((_params) => {
      throw new Error("Not implemented");
    }),
    getActorKey: getActorKey ?? ((_handle) => {
      return Promise.resolve(null);
    }),
    sendActivity: sendActivity ?? ((_params) => {
      throw new Error("Not implemented");
    }),
  };
}

export function createRequestContext<TContextData>(
  args: Partial<RequestContext<TContextData>> & {
    url: URL;
    data: TContextData;
  },
): RequestContext<TContextData> {
  return {
    ...createContext(args),
    request: args.request ?? new Request(args.url),
    url: args.url,
    getActor: args.getActor ?? (() => Promise.resolve(null)),
    getObject: args.getObject ?? (() => Promise.resolve(null)),
    getSignedKey: args.getSignedKey ?? (() => Promise.resolve(null)),
    getSignedKeyOwner: args.getSignedKeyOwner ?? (() => Promise.resolve(null)),
    sendActivity: args.sendActivity ?? ((_params) => {
      throw new Error("Not implemented");
    }),
  };
}
