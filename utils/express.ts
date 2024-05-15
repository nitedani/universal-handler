import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { UniversalHandler } from "../types";
import rfdc from "rfdc";
import diff from "microdiff";

export function fromExpress(req: ExpressRequest): Request {
  const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
  return new Request(fullUrl, {
    // TODO set-cookies special case
    headers: req.headers as Record<string, string>,
    body: req.body,
    method: req.method,
  });
}

export function toExpress(res: Response) {
  return (expressRes: ExpressResponse) => {
    if (!res.body) {
      expressRes.end();
      return Promise.resolve();
    }
    return res.body.pipeTo(
      new WritableStream({
        start() {
          expressRes.writeHead(
            res.status,
            res.statusText,
            Object.fromEntries(res.headers.entries()),
          );
        },
        write(chunk) {
          expressRes.write(chunk);
        },
        close() {
          expressRes.end();
        },
        abort(err) {
          expressRes.end(err);
        },
      }),
    );
  };
}

export function expressWrapper(handler: UniversalHandler) {
  return async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ) => {
    // const reqOri = rfdc({
    //   circles: true,
    //   proto: true,
    // })(req);
    const ctx = {};
    const webResponse = await handler(fromExpress(req), ctx);

    // console.log(diff(reqOri, req));

    (req as any).context = ctx;

    if (webResponse.body) {
      await toExpress(webResponse)(res);
    } else {
      next();
    }
  };
}