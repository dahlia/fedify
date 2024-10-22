declare global {
  namespace Deno {
    export const inspect: (...args: unknown[]) => string;
    type InspectOptions = unknown;
    export const permissions: {
      query: (...args: unknown[]) => Promise<{ state: string }>;
    };
  }
}

export {};
