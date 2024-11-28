import { Activity } from "../vocab/vocab.ts";
import type { InboxListener } from "./callback.ts";

export class InboxListenerSet<TContextData> {
  #listeners: Map<
    new (...args: unknown[]) => Activity,
    InboxListener<TContextData, Activity>
  >;

  constructor() {
    this.#listeners = new Map();
  }

  add<TActivity extends Activity>(
    // deno-lint-ignore no-explicit-any
    type: new (...args: any[]) => TActivity,
    listener: InboxListener<TContextData, TActivity>,
  ): void {
    if (this.#listeners.has(type)) {
      throw new TypeError("Listener already set for this type.");
    }
    this.#listeners.set(
      type,
      listener as InboxListener<TContextData, Activity>,
    );
  }

  dispatchWithClass<TActivity extends Activity>(
    activity: TActivity,
  ): {
    // deno-lint-ignore no-explicit-any
    class: new (...args: any[]) => Activity;
    listener: InboxListener<TContextData, TActivity>;
  } | null {
    // deno-lint-ignore no-explicit-any
    let cls: new (...args: any[]) => Activity = activity
      // deno-lint-ignore no-explicit-any
      .constructor as unknown as new (...args: any[]) => Activity;
    const inboxListeners = this.#listeners;
    if (inboxListeners == null) {
      return null;
    }
    while (true) {
      if (inboxListeners.has(cls)) break;
      if (cls === Activity) return null;
      cls = globalThis.Object.getPrototypeOf(cls);
    }
    const listener = inboxListeners.get(cls)!;
    return { class: cls, listener };
  }

  dispatch<TActivity extends Activity>(
    activity: TActivity,
  ): InboxListener<TContextData, TActivity> | null {
    return this.dispatchWithClass(activity)?.listener ?? null;
  }
}
