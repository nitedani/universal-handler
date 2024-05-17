import type { HattipHandler } from "@hattip/core";
import { createRouter } from "@hattip/router";
import { renderPage } from "vike/server";
import { expressToHattip } from "./adapters/expressToHattip";
const router = createRouter();
import type { Request, Response, NextFunction } from "express";
import { readFile } from "fs/promises";

function expressMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(1);

  res.status(222);
  res.setHeader("my-header", "my-header-value");
  res.write("hello ");
  res.end("world");
  // next();
}

function expressMiddleware2(req: Request, res: Response, next: NextFunction) {
  console.log(2);
  res.send("hello world2");
  res.setHeader("my-header2", "my-header-value2");
  next();
}

async function expressMiddleware3(req: Request, res: Response) {
  console.log(3);
  const image = await readFile("static/IMG_0703.jpg");
  res.setHeader("Content-Type", "image/jpg");
  res.send(image);
}

router.use(expressToHattip(expressMiddleware));
router.use(expressToHattip(expressMiddleware2));
router.use(expressToHattip(expressMiddleware3));

/**
 * Vike route
 *
 * @link {@see https://vike.dev}
 **/
router.use(async (context) => {
  const pageContextInit = { urlOriginal: context.request.url };
  const pageContext = await renderPage(pageContextInit);
  const response = pageContext.httpResponse;

  return new Response(await response?.getBody(), {
    status: response?.statusCode,
    headers: response?.headers,
  });
});

export default router.buildHandler() as HattipHandler;
