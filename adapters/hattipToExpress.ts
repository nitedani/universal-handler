//@ts-nocheck

import type { RequestHandler, RequestContext } from "@hattip/compose";
import type {
  Request,
  Response as ResponseExpress,
  NextFunction,
} from "express";
import { transformResponse } from "../utils/express/transformer";
type MiddlewareExpress = (
  req: Request,
  res: ResponseExpress,
  next: NextFunction
) => void;
export function hattipToExpress(
  requestHandler: RequestHandler
): MiddlewareExpress {
  return async (req, res, next) => {
    const requestContext: RequestContext = req.__requestContext || {
      url: req.url,
      method: req.method,
      locals: {},
      handleError(error) {},
      platform: {
        request: req,
        response: res,
      },
    };
    req.__requestContext = requestContext;
    requestContext.next = async () => {
      next();
    };
    const response = await requestHandler(requestContext);
    if (response) {
      transformResponse(response)(res);
    }
  };
}
