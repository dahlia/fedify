import { openTunnel } from "@hongminhee/localtunnel";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["fedify", "cli", "tempserver"]);

export interface TemporaryServer {
  url: URL;
  close(): Promise<void>;
}

export function spawnTemporaryServer(
  handler: Deno.ServeHandler,
): Promise<TemporaryServer> {
  return new Promise((resolve) => {
    const server = Deno.serve({
      handler,
      port: 0,
      hostname: "::",
      onListen({ port }) {
        logger.debug("Temporary server is listening on port {port}.", { port });
        openTunnel({ port }).then((tun) => {
          logger.debug(
            "Temporary server is tunneled to {url}.",
            { url: tun.url.href },
          );
          resolve({
            url: tun.url,
            async close() {
              await server.shutdown();
              await tun.close();
            },
          });
        });
      },
    });
  });
}
