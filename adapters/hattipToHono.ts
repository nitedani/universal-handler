//@ts-nocheck

import type { RequestHandler, RequestContext } from "@hattip/compose";
import type { MiddlewareHandler } from "hono";

export function hattipToHono(
  requestHandler: RequestHandler
): MiddlewareHandler {
  return async (c, next) => {
    const requestContext: RequestContext = c.get("_store") || {
      url: new URL(c.req.url),
      method: c.req.method,
      locals: {},
      next: async () => {
        await next();
        return c.get("_response");
      },
      handleError(error) {
        c.error = error;
        return c.get("_response");
      },
      platform: {
        request: c.req.raw,
        response: c.res,
      },
    };

    c.set("_store", requestContext);
    const res = await requestHandler(requestContext);
    c.set("_response", res);
    return res;
  };
}
