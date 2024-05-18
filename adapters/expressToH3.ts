import type {
  Request,
  Response as ResponseExpress,
  NextFunction,
} from "express";
import { eventHandler } from "h3";
import { expressToHattip } from "./expressToHattip";
import { hattipToH3 } from "./hattipToH3";

type MiddlewareExpress = (
  req: Request,
  res: ResponseExpress,
  next: NextFunction
) => void;

export function expressToH3(middleware: MiddlewareExpress) {
  return eventHandler(hattipToH3(expressToHattip(middleware)));
}
