import type {
  Request,
  Response as ResponseExpress,
  NextFunction,
} from "express";
import type { MiddlewareHandler } from "hono";
import { expressToHattip } from "./expressToHattip";
import { hattipToHono } from "./hattipToHono";
type MiddlewareExpress = (
  req: Request,
  res: ResponseExpress,
  next: NextFunction
) => void;

export function expressToHono(
  middleware: MiddlewareExpress
): MiddlewareHandler {
  return hattipToHono(expressToHattip(middleware));
}
