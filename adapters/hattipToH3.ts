//@ts-nocheck

import type { RequestHandler, RequestContext } from "@hattip/compose";
import { eventHandler, type EventHandler } from "h3";

export function hattipToH3(requestHandler: RequestHandler): EventHandler {
  return eventHandler(async (c) => {
    const requestContext: RequestContext = c.context._store || {
      url: c.web?.url,
      method: c.method,
      locals: {},
      handleError(error) {},
      platform: {
        request: c.node.req,
        response: c.node.res,
      },
    };

    requestContext.next = async () => {
      // TODO:
      // 1. store request handler stack bound to the request
      // 2. wait for all request handlers to complete, store their return value
      // 3. return the response from the next handler
    };
    c.context._store = requestContext;
    const res = await requestHandler(requestContext);
    // store it here
    return res;
  });
}
