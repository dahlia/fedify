import type { Activity } from "../vocab/vocab.ts";

/**
 * A function that transforms an activity object.
 * @since 1.4.0
 */
export type ActivityTransformer = (activity: Activity) => Activity;
