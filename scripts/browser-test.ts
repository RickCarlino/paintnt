import { extname, join, normalize } from "node:path";
import { existsSync } from "node:fs";

const projectRoot = process.cwd();
const browserTestRoot = join(projectRoot, "browser-test");
const browserTestEntry = join(browserTestRoot, "main.ts");
const browserTestBundleDir = join(browserTestRoot, "dist");

const mode = process.argv[2];

if (mode !== "build" && mode !== "serve") {
  console.error('Usage: bun ./scripts/browser-test.ts <build|serve>');
  process.exit(1);
}

assertBrowserTestExists();

if (mode === "build") {
  await buildBrowserTest();
  process.exit(0);
}

await buildBrowserTest();

const requestedPort = Number(Bun.env.PORT ?? 3087);
const server = startServer(requestedPort);

console.log(`Browser test demo running at http://localhost:${server.port}`);

function assertBrowserTestExists(): void {
  if (!existsSync(browserTestEntry)) {
    console.error(
      'Missing local browser sandbox at "./browser-test". It is intentionally gitignored. Recreate it locally before running browser-test scripts.',
    );
    process.exit(1);
  }
}

async function buildBrowserTest(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [browserTestEntry],
    outdir: browserTestBundleDir,
    target: "browser",
    format: "esm",
    sourcemap: "inline",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    throw new Error("Browser demo build failed");
  }
}

function safeJoin(root: string, pathname: string): string | null {
  const target = normalize(join(root, pathname.slice(1)));

  if (!target.startsWith(root)) {
    return null;
  }

  return target;
}

function contentTypeFor(filePath: string): string | null {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".bmp":
      return "image/bmp";
    default:
      return null;
  }
}

function startServer(preferredPort: number): Server {
  for (const port of [preferredPort, 0]) {
    try {
      return Bun.serve({
        port,
        async fetch(request) {
          const url = new URL(request.url);
          let pathname = decodeURIComponent(url.pathname);

          if (pathname === "/") {
            pathname = "/index.html";
          }

          if (pathname === "/favicon.ico") {
            return new Response(null, { status: 204 });
          }

          if (pathname === "/dist/main.js") {
            try {
              await buildBrowserTest();
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return new Response(message, { status: 500 });
            }
          }

          const filePath = safeJoin(browserTestRoot, pathname);

          if (!filePath) {
            return new Response("Invalid path", { status: 400 });
          }

          const file = Bun.file(filePath);

          if (!(await file.exists())) {
            return new Response("Not found", { status: 404 });
          }

          const headers = new Headers();
          const contentType = contentTypeFor(filePath);

          if (contentType) {
            headers.set("content-type", contentType);
          }

          headers.set("cache-control", pathname.startsWith("/dist/") ? "no-store" : "no-cache");

          return new Response(file, { headers });
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to start the browser test server on port ${preferredPort} or an ephemeral fallback`);
}
