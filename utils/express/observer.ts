import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { deepProxy, LogProxyObserver } from "../proxy.js";

const reqObserver = deepProxy(new LogProxyObserver("req"));
const resObserver = deepProxy(new LogProxyObserver("res"));

export function observer(
  handler: (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ) => void,
) {
  return async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ) => {
    const reqProxy = reqObserver(req);
    const resProxy = resObserver(res);
    return handler(reqProxy, resProxy, next);
  };
}