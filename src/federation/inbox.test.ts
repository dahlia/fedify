import { assertEquals } from "@std/assert/assert-equals";
import { assertThrows } from "@std/assert/assert-throws";
import { test } from "../testing/mod.ts";
import { Activity, Create, Invite, Offer, Update } from "../vocab/vocab.ts";
import { InboxListenerSet } from "./inbox.ts";

test("InboxListenerSet", () => {
  const listeners = new InboxListenerSet<void>();
  const activity = new Activity({});
  const offer = new Offer({});
  const invite = new Invite({});
  const create = new Create({});
  const update = new Update({});

  assertEquals(listeners.dispatch(activity), null);
  assertEquals(listeners.dispatch(offer), null);
  assertEquals(listeners.dispatch(invite), null);
  assertEquals(listeners.dispatch(create), null);
  assertEquals(listeners.dispatch(update), null);

  const listenOffer = () => {};
  listeners.add(Offer, listenOffer);
  assertEquals(listeners.dispatch(activity), null);
  assertEquals(listeners.dispatch(offer), listenOffer);
  assertEquals(listeners.dispatch(invite), listenOffer);
  assertEquals(listeners.dispatch(create), null);
  assertEquals(listeners.dispatch(update), null);

  const listenCreate = () => {};
  listeners.add(Create, listenCreate);
  assertEquals(listeners.dispatch(activity), null);
  assertEquals(listeners.dispatch(offer), listenOffer);
  assertEquals(listeners.dispatch(invite), listenOffer);
  assertEquals(listeners.dispatch(create), listenCreate);
  assertEquals(listeners.dispatch(update), null);

  const listenActivity = () => {};
  listeners.add(Activity, listenActivity);
  assertEquals(listeners.dispatch(activity), listenActivity);
  assertEquals(listeners.dispatch(offer), listenOffer);
  assertEquals(listeners.dispatch(invite), listenOffer);
  assertEquals(listeners.dispatch(create), listenCreate);
  assertEquals(listeners.dispatch(update), listenActivity);

  assertThrows(
    () => listeners.add(Activity, listenActivity),
    TypeError,
    "Listener already set for this type.",
  );
});
