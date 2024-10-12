import type {
  Context,
  InboxContext,
  RequestContext,
} from "../federation/context.ts";
import { RouterError } from "../federation/router.ts";
import {
  lookupObject as globalLookupObject,
  traverseCollection as globalTraverseCollection,
} from "../vocab/lookup.ts";
import { mockDocumentLoader } from "./docloader.ts";

export function createContext<TContextData>(
  {
    url,
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
    getLikedUri,
    getFeaturedUri,
    getFeaturedTagsUri,
    parseUri,
    getActorKeyPairs,
    getDocumentLoader,
    lookupObject,
    traverseCollection,
    sendActivity,
  }: Partial<Context<TContextData>> & { url?: URL; data: TContextData },
): Context<TContextData> {
  function throwRouteError(): URL {
    throw new RouterError("Not implemented");
  }
  url ??= new URL("http://example.com/");
  return {
    data,
    origin: url.origin,
    host: url.host,
    hostname: url.hostname,
    documentLoader: documentLoader ?? mockDocumentLoader,
    contextLoader: contextLoader ?? mockDocumentLoader,
    getNodeInfoUri: getNodeInfoUri ?? throwRouteError,
    getActorUri: getActorUri ?? throwRouteError,
    getObjectUri: getObjectUri ?? throwRouteError,
    getOutboxUri: getOutboxUri ?? throwRouteError,
    getInboxUri: getInboxUri ?? throwRouteError,
    getFollowingUri: getFollowingUri ?? throwRouteError,
    getFollowersUri: getFollowersUri ?? throwRouteError,
    getLikedUri: getLikedUri ?? throwRouteError,
    getFeaturedUri: getFeaturedUri ?? throwRouteError,
    getFeaturedTagsUri: getFeaturedTagsUri ?? throwRouteError,
    parseUri: parseUri ?? ((_uri) => {
      throw new Error("Not implemented");
    }),
    getDocumentLoader: getDocumentLoader ?? ((_params) => {
      throw new Error("Not implemented");
    }),
    getActorKeyPairs: getActorKeyPairs ?? ((_handle) => Promise.resolve([])),
    lookupObject: lookupObject ?? ((uri, options = {}) => {
      return globalLookupObject(uri, {
        documentLoader: options.documentLoader ?? documentLoader ??
          mockDocumentLoader,
        contextLoader: options.contextLoader ?? contextLoader ??
          mockDocumentLoader,
      });
    }),
    traverseCollection: traverseCollection ?? ((collection, options = {}) => {
      return globalTraverseCollection(collection, {
        documentLoader: options.documentLoader ?? documentLoader ??
          mockDocumentLoader,
        contextLoader: options.contextLoader ?? contextLoader ??
          mockDocumentLoader,
      });
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

export function createInboxContext<TContextData>(
  args: Partial<InboxContext<TContextData>> & { url?: URL; data: TContextData },
): InboxContext<TContextData> {
  return {
    ...createContext(args),
    forwardActivity: args.forwardActivity ?? ((_params) => {
      throw new Error("Not implemented");
    }),
  };
}
