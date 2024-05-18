import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { renderPage } from "vike/server";
import type { Request, Response, NextFunction } from "express";
import { hattipToHono } from "./adapters/hattipToHono";
import { RequestContext } from "@hattip/compose";
import { readFile } from "fs/promises";
import { expressToHono } from "./adapters/expressToHono";

const isProduction = process.env.NODE_ENV === "production";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = new Hono();

function expressMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(1);
  res.status(223);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("my-header1", "my-header-value1");
  const largeArrayOfLetters = new Array(222).fill("abcd");
  // res.write(largeArrayOfLetters.join(""));
  // res.end();
  next();
}

function expressMiddleware2(req: Request, res: Response, next: NextFunction) {
  console.log(2);
  res.setHeader("my-header2", "my-header-value2");
  // res.end("23");

  next();
}

function hattipHandler(ctx: RequestContext) {
  console.log("hattip handler");

  return ctx.next();
  return new Response("hello world", {
    status: 211,
    headers: {
      "my-header4": "my-header-value4",
    },
  });
}

async function expressMiddleware3(req: Request, res: Response) {
  console.log(3);
  const image = await readFile("static/IMG_0703.jpg");
  res.setHeader("Content-Type", "image/jpg");
  res.send(image);
}

app.use(compress());

if (isProduction) {
  app.use(
    "/*",
    serveStatic({
      root: `dist/client/`,
    })
  );
}

app.use(expressToHono(expressMiddleware));
app.use(expressToHono(expressMiddleware2));
app.use(hattipToHono(hattipHandler));
app.use(expressToHono(expressMiddleware3));

app.all("*", async (c, next) => {
  const pageContextInit = {
    urlOriginal: c.req.url,
  };
  const pageContext = await renderPage(pageContextInit);
  const { httpResponse } = pageContext;
  if (!httpResponse) {
    return next();
  } else {
    const { body, statusCode, headers } = httpResponse;
    headers.forEach(([name, value]) => c.header(name, value));
    c.status(statusCode);

    return c.body(body);
  }
});

if (isProduction) {
  console.log(`Server listening on http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port: port,
  });
}

export default app;
