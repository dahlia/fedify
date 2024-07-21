import { colors } from "@cliffy/ansi";
import { Command, EnumType } from "@cliffy/command";
import { Select } from "@cliffy/prompt";
import { getLogger } from "@logtape/logtape";
import { dirname, join } from "@std/path";
import { format, greaterThan, parse } from "@std/semver";
import metadata from "./deno.json" with { type: "json" };

type Runtime = "deno" | "bun" | "node";

interface RuntimeDescription {
  label: string;
  checkCommand: [string, ...string[]];
  outputPattern: RegExp;
}

const runtimes: Record<Runtime, RuntimeDescription> = {
  deno: {
    label: "Deno",
    checkCommand: ["deno", "--version"],
    outputPattern: /^deno\s+\d+\.\d+\.\d+\b/,
  },
  bun: {
    label: "Bun",
    checkCommand: ["bun", "--version"],
    outputPattern: /^\d+\.\d+\.\d+$/,
  },
  node: {
    label: "Node.js",
    checkCommand: ["node", "--version"],
    outputPattern: /^v\d+\.\d+\.\d+$/,
  },
};

const runtimeAvailabilities: Record<Runtime, boolean> = Object.fromEntries(
  await Promise.all(
    (Object.keys(runtimes) as Runtime[])
      .map(async (r) => [r, await isRuntimeAvailable(r)]),
  ),
);

type PackageManager = "npm" | "yarn" | "pnpm";

interface PackageManagerDescription {
  label: string;
  checkCommand: [string, ...string[]];
  outputPattern: RegExp;
}

const packageManagers: Record<PackageManager, PackageManagerDescription> = {
  npm: {
    label: "npm",
    checkCommand: ["npm", "--version"],
    outputPattern: /^\d+\.\d+\.\d+$/,
  },
  yarn: {
    label: "Yarn",
    checkCommand: ["yarn", "--version"],
    outputPattern: /^\d+\.\d+\.\d+$/,
  },
  pnpm: {
    label: "pnpm",
    checkCommand: ["pnpm", "--version"],
    outputPattern: /^\d+\.\d+\.\d+$/,
  },
};

const packageManagerAvailabilities: Record<PackageManager, boolean> = Object
  .fromEntries(
    await Promise.all(
      (Object.keys(packageManagers) as PackageManager[])
        .map(async (pm) => [pm, await isPackageManagerAvailable(pm)]),
    ),
  );

type WebFramework = "astro" | "fresh" | "hono";

interface WebFrameworkInitializer {
  command?: [string, ...string[]];
  dependencies?: Record<string, string>;
  federationFile: string;
  files?: Record<string, string>;
  tasks?: Record<string, string>;
  instruction: string;
}

interface WebFrameworkDescription {
  label: string;
  runtimes: Runtime[] | null;
  init(runtime: Runtime, pm: PackageManager): WebFrameworkInitializer;
}

const webFrameworks: Record<WebFramework, WebFrameworkDescription> = {
  astro: {
    label: "Astro",
    runtimes: ["bun", "node"],
    init: (runtime, pm) => ({
      command: [
        runtime === "bun" ? "bun" : pm,
        "create",
        "astro@^4.8.0",
        ...(pm === "npm" ? ["--"] : []),
        "--skip-houston",
        "--typescript=strict",
        "--no-install",
        "--no-git",
        ".",
      ],
      federationFile: "src/federation.ts",
      files: {
        "src/middleware.ts": `\
import type { MiddlewareHandler } from "astro";
import { createMiddleware } from "@fedify/fedify/x/astro";
import federation from "./federation";

export const onRequest: MiddlewareHandler = createMiddleware(
  federation,
  (astroContext) => undefined,
);
`,
        "astro.config.mjs": `\
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server"
});
`,
      },
      instruction: `
To start the server, run the following command:

  ${
        colors.bold.green(
          runtime === "bun" ? "bun dev" : `${pm} run dev`,
        )
      }

Then, try look up an actor from your server:

  ${colors.bold.green("fedify lookup http://localhost:4321/users/john")}

`,
    }),
  },
  fresh: {
    label: "Fresh",
    runtimes: ["deno"],
    init: (_, __) => ({
      command: [
        "deno",
        "run",
        "-A",
        "https://deno.land/x/fresh@1.6.8/init.ts",
        ".",
      ],
      federationFile: "federation/mod.ts",
      files: {
        "routes/_middleware.ts": `\
import { Handler } from "$fresh/server.ts";
import federation from "../federation/mod.ts";
import { integrateHandler } from "@fedify/fedify/x/fresh";

// This is the entry point to the Fedify middleware from the Fresh framework:
export const handler: Handler = integrateHandler(federation, () => undefined);
`,
      },
      instruction: `
To start the server, run the following command:

  ${colors.bold.green("deno task start")}

Then, try look up an actor from your server:

  ${colors.bold.green("fedify lookup http://localhost:8000/users/john")}
`,
    }),
  },
  hono: {
    label: "Hono",
    runtimes: null,
    init: (runtime, pm) => ({
      dependencies: runtime === "deno"
        ? { "@hono/hono": "^4.5.0" } as Record<string, string>
        : runtime === "node"
        ? { hono: "^4.5.0", "@hono/node-server": "^1.12.0", tsx: "^4.16.2" }
        : { hono: "^4.5.0" },
      federationFile: "src/federation.ts",
      files: {
        "src/app.ts": `\
import { Hono } from "${runtime === "deno" ? "@hono/hono" : "hono"}";

const app = new Hono();

app.get("/", (c) => c.text("Hello, Fedify!"));

export default app;
`,
        "src/index.ts": runtime === "node"
          ? `\
import { serve } from "@hono/node-server"
import app from "./app";

serve(
  {
    port: 8000,
    fetch: app.fetch.bind(app),
  },
  (info) =>
    console.log("Server started at http://" + info.address + ":" + info.port)
);
`
          : runtime === "bun"
          ? `\
import app from "./app";

const server = Bun.serve({
  fetch: app.fetch.bind(app),
});

console.log("Server started at", server.url.href);
`
          : `\
import app from "./app.ts";

Deno.serve(
  {
    port: 8000,
    onListen: ({ port, hostname }) =>
      console.log("Server started at http://" + hostname + ":" + port)
  },
  app.fetch.bind(app),
);
`,
      },
      tasks: {
        "dev": runtime === "deno"
          ? "deno run -A ./src/index.ts"
          : runtime === "bun"
          ? "bun run ./src/index.ts"
          : "node --import tsx ./src/index.ts",
      },
      instruction: `
To start the server, run the following command:

  ${
        colors.bold.green(
          runtime === "deno"
            ? "deno task dev"
            : runtime === "bun"
            ? "bun dev"
            : `${pm} run dev`,
        )
      }

Then, try look up an actor from your server:

  ${colors.bold.green("fedify lookup http://localhost:8000/users/john")}
`,
    }),
  },
} as const;

type KvStore = "redis" | "denokv";

interface KvStoreDescription {
  label: string;
  runtimes?: Runtime[];
  dependencies?: Record<string, string>;
  imports?: Record<string, string[]>;
  object: string;
  denoUnstable?: string[];
}

const kvStores: Record<KvStore, KvStoreDescription> = {
  redis: {
    label: "Redis",
    dependencies: { "@fedify/redis": "^0.1.1", "npm:ioredis": "^5.4.1" },
    imports: { "@fedify/redis": ["RedisKvStore"], ioredis: ["Redis"] },
    object: "new RedisKvStore(new Redis())",
  },
  denokv: {
    label: "Deno KV",
    runtimes: ["deno"],
    imports: { "@fedify/fedify/x/denokv": ["DenoKvStore"] },
    object: "new DenoKvStore(await Deno.openKv())",
    denoUnstable: ["kv"],
  },
} as const;

type MessageQueue = "redis" | "denokv";

interface MessageQueueDescription {
  label: string;
  runtimes?: Runtime[];
  dependencies?: Record<string, string>;
  imports?: Record<string, string[]>;
  object: string;
  denoUnstable?: string[];
}

const messageQueues: Record<MessageQueue, MessageQueueDescription> = {
  redis: {
    label: "Redis",
    dependencies: { "@fedify/redis": "^0.1.1", "npm:ioredis": "^5.4.1" },
    imports: { "@fedify/redis": ["RedisMessageQueue"], ioredis: ["Redis"] },
    object: "new RedisMessageQueue(() => new Redis())",
  },
  denokv: {
    label: "Deno KV",
    runtimes: ["deno"],
    imports: { "@fedify/fedify/x/denokv": ["DenoKvMessageQueue"] },
    object: "new DenoKvMessageQueue(await Deno.openKv())",
    denoUnstable: ["kv"],
  },
} as const;

const logger = getLogger(["fedify", "cli", "init"]);

export const command = new Command()
  .type(
    "runtime",
    new EnumType(
      (Object.keys(runtimes) as Runtime[]).filter((r) =>
        runtimeAvailabilities[r]
      ),
    ),
  )
  .type(
    "package-manager",
    new EnumType(
      (Object.keys(packageManagers) as PackageManager[]).filter((pm) =>
        packageManagerAvailabilities[pm]
      ),
    ),
  )
  .type(
    "web-framework",
    new EnumType(Object.keys(webFrameworks) as WebFramework[]),
  )
  .type("kv-store", new EnumType(Object.keys(kvStores) as KvStore[]))
  .type(
    "message-queue",
    new EnumType(Object.keys(messageQueues) as MessageQueue[]),
  )
  .arguments("<dir:file>")
  .description("Initialize a new Fedify project directory.")
  .option(
    "-r, --runtime <runtime:runtime>",
    "Choose the JavaScript runtime to use.",
  )
  .option(
    "-p, --package-manager <package-manager:package-manager>",
    "Choose the package manager to use.  Only applicable to -r/--runtime=node.",
  )
  .option(
    "-w, --web-framework <web-framework:web-framework>",
    "Choose the web framework to integrate Fedify with.",
  )
  .option(
    "-k, --kv-store <kv-store:kv-store>",
    "Choose the key-value store to use for caching.",
  )
  .option(
    "-q, --message-queue <message-queue:message-queue>",
    "Choose the message queue to use for background jobs.",
  )
  .action(async (options, dir: string) => {
    let dinosaurDrawn = false;
    let runtime = options.runtime;
    if (runtime == null) {
      drawDinosaur();
      dinosaurDrawn = true;
      runtime = await Select.prompt({
        message: "Choose the JavaScript runtime to use",
        options: Object.entries(runtimes).map(([value, { label }]) => ({
          name: label,
          value,
          disabled: !runtimeAvailabilities[value as Runtime],
        })),
      }) as unknown as Runtime;
    }
    let packageManager = options.packageManager;
    if (runtime === "node" && packageManager == null) {
      if (!dinosaurDrawn) {
        drawDinosaur();
        dinosaurDrawn = true;
      }
      packageManager = await Select.prompt({
        message: "Choose the package manager to use",
        options: Object.entries(packageManagers).map(([value, { label }]) => ({
          name: label,
          value,
        })),
      }) as unknown as PackageManager;
    } else if (packageManager == null) packageManager = "npm";
    let webFramework = options.webFramework;
    if (webFramework == null && options.runtime == null) {
      if (!dinosaurDrawn) {
        drawDinosaur();
        dinosaurDrawn = true;
      }
      webFramework = await Select.prompt({
        message: "Choose the web framework to integrate Fedify with",
        options: [
          { name: "Bare-bones", value: null },
          ...Object.entries(webFrameworks).map((
            [value, { label, runtimes }],
          ) => ({
            name: label,
            value,
            disabled: runtimes != null && !runtimes.includes(runtime),
          })),
        ],
      }) as unknown as WebFramework;
    }
    if (
      webFramework != null && webFrameworks[webFramework].runtimes != null &&
      !webFrameworks[webFramework].runtimes!.includes(runtime)
    ) {
      console.error(
        `The ${
          webFrameworks[webFramework].label
        } framework is not available on the ${
          runtimes[runtime].label
        } runtime.`,
      );
      Deno.exit(1);
    }
    let kvStore = options.kvStore;
    if (kvStore == null && options.runtime == null) {
      if (!dinosaurDrawn) {
        drawDinosaur();
        dinosaurDrawn = true;
      }
      kvStore = await Select.prompt({
        message: "Choose the key-value store to use for caching",
        options: [
          { name: "In-memory", value: null },
          ...Object.entries(kvStores).map(([value, { label, runtimes }]) => ({
            name: label,
            value,
            disabled: runtimes != null && !runtimes.includes(runtime),
          })),
        ],
      }) as unknown as KvStore;
    }
    if (
      kvStore != null && kvStores[kvStore].runtimes != null &&
      !kvStores[kvStore].runtimes!.includes(runtime)
    ) {
      console.error(
        `The ${kvStores[kvStore].label} store is not available on the ${
          runtimes[runtime].label
        } runtime.`,
      );
      Deno.exit(1);
    }
    let messageQueue = options.messageQueue;
    if (messageQueue == null && options.runtime == null) {
      if (!dinosaurDrawn) {
        drawDinosaur();
        dinosaurDrawn = true;
      }
      messageQueue = await Select.prompt({
        message: "Choose the message queue to use for background jobs",
        options: [
          { name: "In-process", value: null },
          ...Object.entries(messageQueues).map((
            [value, { label, runtimes }],
          ) => ({
            name: label,
            value,
            disabled: runtimes != null && !runtimes.includes(runtime),
          })),
        ],
      }) as unknown as MessageQueue;
    }
    if (
      messageQueue != null && messageQueues[messageQueue].runtimes != null &&
      !messageQueues[messageQueue].runtimes!.includes(runtime)
    ) {
      console.error(
        `The ${
          messageQueues[messageQueue].label
        } message queue is not available on the ${
          runtimes[runtime].label
        } runtime.`,
      );
      Deno.exit(1);
    }
    logger.debug(
      "Runtime: {runtime}; package manager: {packageManager}; " +
        "web framework: {webFramework}; key-value store: {kvStore}; " +
        "message queue: {messageQueue}",
      {
        runtime,
        packageManager,
        webFramework,
        kvStore,
        messageQueue,
      },
    );
    if (!runtimeAvailabilities[runtime]) {
      console.error(
        `The ${
          runtimes[runtime].label
        } runtime is not available on this system.`,
      );
      Deno.exit(1);
    }
    if (runtime === "node" && !packageManagerAvailabilities[packageManager]) {
      console.error(`The ${packageManager} is not available on this system.`);
      Deno.exit(1);
    }
    let initializer: WebFrameworkInitializer;
    if (webFramework == null) {
      initializer = {
        federationFile: "federation.ts",
        dependencies: runtime === "node"
          ? { "@hono/node-server": "^1.12.0", tsx: "^4.16.2" }
          : {},
        files: {
          "main.ts": runtime === "node"
            ? `\
import { serve } from '@hono/node-server'
import federation from "./federation";

serve(
  {
    port: 8000,
    fetch: (req) => federation.fetch(req, { contextData: undefined })
  },
  (info) =>
    console.log("Server started at http://" + info.address + ":" + info.port)
);
`
            : runtime === "bun"
            ? `\
import federation from "./federation";

const server = Bun.serve({
  fetch: (req) => federation.fetch(req, { contextData: undefined }),
});

console.log("Server started at", server.url.href);
`
            : `\
import federation from "./federation.ts";

Deno.serve(
  {
    port: 8000,
    onListen: ({ port, hostname }) =>
      console.log("Server started at http://" + hostname + ":" + port)
  },
  (req) => federation.fetch(req, { contextData: undefined }),
);
`,
        },
        tasks: {
          "dev": runtime === "deno"
            ? "deno run -A ./main.ts"
            : runtime === "bun"
            ? "bun run ./main.ts"
            : "node --import tsx ./main.ts",
        },
        instruction: `
To start the server, run the following command:

  ${
          colors.bold.green(
            runtime === "deno"
              ? "deno task dev"
              : runtime === "bun"
              ? "bun dev"
              : `${packageManager} run dev`,
          )
        }

Then, try look up an actor from your server:

  ${colors.bold.green("fedify lookup http://localhost:8000/users/john")}
`,
      };
    } else {
      const desc = webFrameworks[webFramework];
      if (desc.runtimes != null && !desc.runtimes.includes(runtime)) {
        console.error(
          `The ${desc.label} framework is not available on the ${
            runtimes[runtime].label
          } runtime.`,
        );
        Deno.exit(1);
      }
      initializer = desc.init(runtime, packageManager);
    }
    const kvStoreDesc: KvStoreDescription = kvStore != null
      ? kvStores[kvStore]
      : {
        label: "",
        imports: { "@fedify/fedify": ["MemoryKvStore"] },
        object: "new MemoryKvStore()",
      };
    const mqDesc: MessageQueueDescription = messageQueue != null
      ? messageQueues[messageQueue]
      : {
        label: "",
        imports: { "@fedify/fedify": ["InProcessMessageQueue"] },
        object: "new InProcessMessageQueue()",
      };
    const imports: Record<string, string[]> = {};
    for (
      const [module, symbols] of [
        ...Object.entries(kvStoreDesc.imports ?? {}),
        ...Object.entries(mqDesc.imports ?? {}),
      ]
    ) {
      if (module in imports) {
        for (const symbol of symbols) {
          if (imports[module].includes(symbol)) continue;
          imports[module].push(symbol);
        }
      } else {
        imports[module] = symbols;
      }
    }
    const importStatements = Object.entries(imports)
      .map(([module, symbols]) =>
        `import { ${symbols.join(", ")} } from ${JSON.stringify(module)};\n`
      )
      .join("");
    const federation = `\
import { createFederation, Person } from "@fedify/fedify";
${importStatements}

const federation = createFederation({
  kv: ${kvStoreDesc.object},
  queue: ${mqDesc.object},
});

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  return new Person({
    id: ctx.getActorUri(handle),
    preferredUsername: handle,
    name: handle,
  });
})

export default federation;
`;
    const files = {
      [initializer.federationFile]: federation,
      ...initializer.files,
    };
    await Deno.mkdir(dir, { recursive: true });
    for await (const _ of Deno.readDir(dir)) {
      console.error("The directory is not empty.  Aborting.");
      Deno.exit(1);
    }
    if (initializer.command != null) {
      const cmd = new Deno.Command(initializer.command[0], {
        args: initializer.command.slice(1),
        cwd: dir,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const result = await cmd.output();
      if (!result.success) {
        console.error("Failed to initialize the project.");
        Deno.exit(1);
      }
    }
    if (runtime !== "deno") {
      const packageJsonPath = join(dir, "package.json");
      try {
        await Deno.stat(packageJsonPath);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          await Deno.writeTextFile(packageJsonPath, "{}");
        } else throw e;
      }
    }
    const dependencies: Record<string, string> = {
      "@fedify/fedify": `^${await getLatestFedifyVersion(metadata.version)}`,
      ...initializer.dependencies,
      ...kvStoreDesc?.dependencies,
      ...mqDesc?.dependencies,
    };
    await addDependencies(
      runtime,
      packageManager,
      dir,
      dependencies,
    );
    for (const [filename, content] of Object.entries(files)) {
      const path = join(dir, filename);
      const dirName = dirname(path);
      await Deno.mkdir(dirName, { recursive: true });
      await Deno.writeTextFile(path, content);
    }
    if (runtime === "deno") {
      const cfgPath = join(dir, "deno.json");
      const cfg = JSON.parse(await Deno.readTextFile(cfgPath));
      await Deno.writeTextFile(
        cfgPath,
        JSON.stringify(
          {
            ...cfg,
            unstable: [
              "temporal",
              ...kvStoreDesc.denoUnstable ?? [],
              ...mqDesc.denoUnstable ?? [],
            ],
            tasks: { ...cfg.tasks, ...initializer.tasks },
          },
          null,
          2,
        ),
      );
    } else {
      const cfgPath = join(dir, "package.json");
      const cfg = JSON.parse(await Deno.readTextFile(cfgPath));
      await Deno.writeTextFile(
        cfgPath,
        JSON.stringify(
          {
            type: "module",
            ...cfg,
            scripts: { ...cfg.scripts, ...initializer.tasks },
          },
          null,
          2,
        ),
      );
    }
    console.error(initializer.instruction);
    console.error(`\
Start by editing the ${colors.bold.blue(initializer.federationFile)} \
file to define your federation!
`);
  });

function drawDinosaur() {
  console.error(`\
       __        _____        _ _  __
      / _)      |  ___|__  __| (_)/ _|_   _
 .-^^^-/ /      | |_ / _ \\/ _\` | | |_| | | |
 __/      /     |  _|  __/ (_| | |  _| |_| |
<__.|_|-|_|     |_|  \\___|\\__,_|_|_|  \\__, |
                                      |___/
`);
}

async function isCommandAvailable(
  { checkCommand, outputPattern }: {
    checkCommand: [string, ...string[]];
    outputPattern: RegExp;
  },
): Promise<boolean> {
  const cmd = new Deno.Command(checkCommand[0], {
    args: checkCommand.slice(1),
    stdin: "null",
    stdout: "piped",
    stderr: "null",
  });
  try {
    const output = await cmd.output();
    const stdout = new TextDecoder().decode(output.stdout);
    return outputPattern.exec(stdout.trim()) ? true : false;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

function isRuntimeAvailable(runtime: Runtime): Promise<boolean> {
  return isCommandAvailable(runtimes[runtime]);
}

function isPackageManagerAvailable(pm: PackageManager): Promise<boolean> {
  return isCommandAvailable(packageManagers[pm]);
}

async function addDependencies(
  runtime: Runtime,
  pm: PackageManager,
  dir: string,
  dependencies: Record<string, string>,
): Promise<void> {
  const deps = Object.entries(dependencies)
    .map(([name, version]) =>
      `${
        runtime != "deno" && name.startsWith("npm:") ? name.substring(4) : name
      }@${version}`
    );
  if (deps.length < 1) return;
  const cmd = new Deno.Command(
    runtime === "node" ? pm : runtime,
    {
      args: ["add", ...deps],
      cwd: dir,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const result = await cmd.output();
  if (!result.success) {
    throw new Error("Failed to add dependencies.");
  }
}

async function getLatestFedifyVersion(version: string): Promise<string> {
  const response = await fetch("https://jsr.io/@fedify/fedify/meta.json", {
    headers: {
      Accept: "application/json",
    },
  });
  const result = await response.json();
  let maxVersion = parse("0.0.0");
  for (const v in result.versions) {
    if (v === version) return version;
    else if (result.versions[v].yanked) continue;
    const semVer = parse(v);
    if (greaterThan(semVer, maxVersion)) maxVersion = semVer;
  }
  return format(maxVersion);
}
