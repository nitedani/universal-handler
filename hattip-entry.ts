import type { HattipHandler } from "@hattip/core";
import { createRouter } from "@hattip/router";
import { renderPage } from "vike/server";
import { expressToHattip } from "./adapters/expressToHattip";
const router = createRouter();
import type { Request, Response, NextFunction } from "express";

function expressMiddleware(req: Request, res: Response, next: NextFunction) {
  res.status(200);
  next();
  // res.send("hello world")
}

router.use(expressToHattip(expressMiddleware));

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
