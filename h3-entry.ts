import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import installCrypto from "@hattip/polyfills/crypto";
import installGetSetCookie from "@hattip/polyfills/get-set-cookie";
import installWhatwgNodeFetch from "@hattip/polyfills/whatwg-node";
import {
  createApp,
  createRouter,
  eventHandler,
  fromNodeMiddleware,
  setResponseHeaders,
  setResponseStatus,
  toNodeListener,
} from "h3";
import serveStatic from "serve-static";
import { renderPage } from "vike/server";
import { hattipToH3 } from "./adapters/hattipToH3";
import { expressToH3 } from "./adapters/expressToH3";
import type { Request, Response, NextFunction } from "express";
import { RequestContext } from "@hattip/compose";

installWhatwgNodeFetch();
installGetSetCookie();
installCrypto();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";
const root = __dirname;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const hmrPort = process.env.HMR_PORT
  ? parseInt(process.env.HMR_PORT, 10)
  : 24679;

startServer();

async function startServer() {
  const app = createApp();

  if (isProduction) {
    app.use("/", fromNodeMiddleware(serveStatic(`${root}/dist/client`)));
  } else {
    // Instantiate Vite's development server and integrate its middleware to our server.
    // ⚠️ We should instantiate it *only* in development. (It isn't needed in production
    // and would unnecessarily bloat our server in production.)
    const vite = await import("vite");
    const viteDevMiddleware = (
      await vite.createServer({
        root,
        server: { middlewareMode: true, hmr: { port: hmrPort } },
      })
    ).middlewares;
    app.use(fromNodeMiddleware(viteDevMiddleware));
  }

  const router = createRouter();

  function expressMiddleware(req: Request, res: Response, next: NextFunction) {
    console.log(1);
    res.status(223);
    res.setHeader("Content-Type", "text/plain");
    const largeArrayOfLetters = new Array(222).fill("abcd");
    res.write(largeArrayOfLetters.join(""));
    res.end();
    // next();
  }

  function hattipHandler(ctx: RequestContext) {
    return new Response("hello world", {
      status: 211,
      headers: {
        "my-header4": "my-header-value4",
      },
    });
  }

  app.use(expressToH3(expressMiddleware));
  app.use(hattipToH3(hattipHandler));

  /**
   * Vike route
   *
   * @link {@see https://vike.dev}
   **/
  router.use(
    "/**",
    eventHandler(async (event) => {
      const pageContextInit = {
        urlOriginal: event.node.req.originalUrl || event.node.req.url!,
      };

      const pageContext = await renderPage(pageContextInit);
      const response = pageContext.httpResponse;

      setResponseStatus(event, response?.statusCode);
      setResponseHeaders(event, Object.fromEntries(response?.headers ?? []));

      return response?.getBody();
    })
  );

  app.use(router);

  const server = createServer(toNodeListener(app)).listen(port);

  server.on("listening", () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
