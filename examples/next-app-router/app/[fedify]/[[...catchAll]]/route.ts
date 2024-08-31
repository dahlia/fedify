import {
  Accept,
  Endpoints,
  Follow,
  Person,
  Undo,
  createFederation,
  generateCryptoKeyPair,
  MemoryKvStore,
} from "@fedify/fedify";
import { keyPairsStore, relationStore } from "~/data/store";
import { integrateFederation } from "~/shared/integrate-fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

const requestHanlder = integrateFederation(federation, () => {});

export {
  requestHanlder as GET,
  requestHanlder as POST,
  requestHanlder as PUT,
  requestHanlder as PATCH,
  requestHanlder as DELETE,
};

federation
  .setActorDispatcher("/users/{handle}", async (context, handle) => {
    if (handle != "demo") {
      return null;
    }
    const keyPairs = await context.getActorKeyPairs(handle);
    return new Person({
      id: context.getActorUri(handle),
      name: "Fedify Demo",
      summary: "This is a Fedify Demo account.",
      preferredUsername: handle,
      url: new URL("/", context.url),
      inbox: context.getInboxUri(handle),
      endpoints: new Endpoints({
        sharedInbox: context.getInboxUri(),
      }),
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((keyPair) => keyPair.multikey),
    });
  })
  .setKeyPairsDispatcher(async (_, handle) => {
    if (handle != "demo") {
      return [];
    }
    const keyPairs = keyPairsStore.get(handle);
    if (keyPairs) {
      return keyPairs;
    }
    const { privateKey, publicKey } = await generateCryptoKeyPair();
    keyPairsStore.set(handle, [{ privateKey, publicKey }]);
    return [{ privateKey, publicKey }];
  });

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (context, follow) => {
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const result = context.parseUri(follow.objectId);
    if (result?.type !== "actor" || result.handle !== "demo") {
      return;
    }
    const follower = await follow.getActor(context);
    if (follower?.id == null) {
      throw new Error("follower is null");
    }
    await context.sendActivity(
      { handle: result.handle },
      follower,
      new Accept({
        id: new URL(
          `#accepts/${follower.id.href}`,
          context.getActorUri("demo")
        ),
        actor: follow.objectId,
        object: follow,
      })
    );
    relationStore.set(follower.id.href, follow.actorId.href);
  })
  .on(Undo, async (context, undo) => {
    const activity = await undo.getObject(context);
    if (activity instanceof Follow) {
      if (activity.id == null) {
        return;
      }
      if (undo.actorId == null) {
        return;
      }
      relationStore.delete(undo.actorId.href);
    } else {
      console.debug(undo);
    }
  });
