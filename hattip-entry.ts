import type { HattipHandler } from "@hattip/core";
import { createRouter } from "@hattip/router";
import { renderPage } from "vike/server";
import { expressToHattip } from "./adapters/expressToHattip";
const router = createRouter();
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { readFile } from "fs/promises";
import { createReadStream } from "fs";
import compression from "compression";

function expressMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(1);
  res.status(223);
  res.setHeader("Content-Type", "text/plain");
  const largeArrayOfLetters = new Array(222).fill("abcd");
  res.write(largeArrayOfLetters.join(""));
  // res.end();
  next();
}

function expressMiddleware2(req: Request, res: Response, next: NextFunction) {
  console.log(2);
  // res.setHeader("my-header2", "my-header-value2");
  res.end("23");

  // next();
}

async function expressMiddleware3(req: Request, res: Response) {
  console.log(3);
  const image = await readFile("static/IMG_0703.jpg");
  res.setHeader("Content-Type", "image/jpg");
  res.send(image);
}

async function expressMiddleware4(req: Request, res: Response) {
  console.log(4);
  const image = createReadStream("static/IMG_0703.jpg");
  res.setHeader("Content-Type", "image/jpg");
  image.pipe(res);
}
router.use(expressToHattip(compression()));
router.use(expressToHattip(express.static("static")));
router.use(expressToHattip(expressMiddleware));
router.use(expressToHattip(expressMiddleware2));
router.use(expressToHattip(expressMiddleware3));
router.use(expressToHattip(expressMiddleware4));

/**
 * Vike route
 *
 * @link {@see https://vike.dev}
 **/
router.use(async (context) => {
  console.log(444);

  const pageContextInit = { urlOriginal: context.request.url };
  const pageContext = await renderPage(pageContextInit);
  const response = pageContext.httpResponse;

  return new Response(await response?.getBody(), {
    status: response?.statusCode,
    headers: response?.headers,
  });
});

export default router.buildHandler() as HattipHandler;
