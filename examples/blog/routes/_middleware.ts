import { Handler } from "$fresh/server.ts";
import { federation } from "../federation/mod.ts";
import { integrateHandler } from "@fedify/fedify/x/fresh";

// This is the entry point to the Fedify middleware from the Fresh framework:
export const handler: Handler = integrateHandler(federation, () => undefined);
