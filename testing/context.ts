import type { Context, RequestContext } from "../federation/context.ts";
import { RouterError } from "../federation/router.ts";
import { mockDocumentLoader } from "./docloader.ts";

export function createContext<TContextData>(
  {
    data,
    documentLoader,
    getNodeInfoUri,
    getActorUri,
    getOutboxUri,
    getInboxUri,
    getFollowingUri,
    getFollowersUri,
    getHandleFromActorUri,
    getActorKey,
    getDocumentLoader,
    sendActivity,
  }: Partial<Context<TContextData>> & { data: TContextData },
): Context<TContextData> {
  function throwRouteError(_handle?: string): URL {
    throw new RouterError("Not implemented");
  }
  return {
    data,
    documentLoader: documentLoader ?? mockDocumentLoader,
    getNodeInfoUri: getNodeInfoUri ?? throwRouteError,
    getActorUri: getActorUri ?? throwRouteError,
    getOutboxUri: getOutboxUri ?? throwRouteError,
    getInboxUri: getInboxUri ?? throwRouteError,
    getFollowingUri: getFollowingUri ?? throwRouteError,
    getFollowersUri: getFollowersUri ?? throwRouteError,
    getHandleFromActorUri: getHandleFromActorUri ?? ((_uri) => {
      throw new Error("Not implemented");
    }),
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
    getSignedKey: args.getSignedKey ?? (() => Promise.resolve(null)),
  };
}
