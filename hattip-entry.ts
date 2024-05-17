import type { HattipHandler } from "@hattip/core";
import { createRouter } from "@hattip/router";
import { renderPage } from "vike/server";
import { expressToHattip } from "./adapters/expressToHattip";
const router = createRouter();
import type { Request, Response, NextFunction } from "express";

function expressMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(1);

  res.status(222);
  res.setHeader("my-header", "my-header-value");
  // res.send("hello world");
  // res.end("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  next();
}

function expressMiddleware2(req: Request, res: Response, next: NextFunction) {
  // console.log(2);
  // res.send("hello world2");
  res.setHeader("my-header2", "my-header-value2");
  next();
}

router.use(
  expressToHattip(expressMiddleware),
  expressToHattip(expressMiddleware2)
);

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
