import { PassThrough, Readable } from "stream";
import { ReadableStream } from "stream/web";
import type {
  Request,
  Response as ResponseExpress,
  NextFunction,
} from "express";
import type { RequestHandler } from "@hattip/compose";
type MiddlewareExpress = (
  req: Request,
  res: ResponseExpress,
  next: NextFunction
) => void;

export function expressToHattip(middleware: MiddlewareExpress): RequestHandler {
  return (ctx) => {
    return new Promise<Response | void>((resolve) => {
      const responseHeaders: Record<string, string> = {};
      let responseStatus = 200;
      const res = new Proxy(new PassThrough(), {
        get(target, prop) {
          if (prop === "headers") {
            return responseHeaders;
          }
          if (prop === "statusCode") {
            return responseStatus;
          }
          return Reflect.get(target, prop);
        },
        set(target, p, newValue, receiver) {
          if (p === "statusCode") {
            responseStatus = newValue;
          } else {
            return Reflect.set(target, p, newValue, receiver);
          }
          return true;
        },
      });
      const originalWrite = res.write.bind(res);

      /////////////////////////////
      /////////////////////////////
      /////////////////////////////

      // @ts-ignore
      res.status = (status: number) => (responseStatus = status);
      // @ts-ignore
      res.setHeader = (key: string, value: string) => {
        responseHeaders[key] = value;
      };
      // @ts-ignore
      res.getHeader = (key: string) => responseHeaders[key];
      // @ts-ignore
      res.removeHeader = (key: string) => delete responseHeaders[key];
      // @ts-ignore
      res.writeHead = (
        status_: number,
        headersOrMessage?: Record<string, string> | string
      ) => {
        responseStatus = status_;
        if (typeof headersOrMessage === "object") {
          Object.assign(responseHeaders, headersOrMessage);
        }
      };
      res.write = (...args) => {
        resolveResponse();
        // @ts-ignore
        return originalWrite(...args);
      };
      const originalEnd = res.end.bind(res);
      res.end = (...args) => {
        resolveResponse();
        // @ts-ignore
        return originalEnd(...args);
      };
      // @ts-ignore
      res.send = (body: string) => {
        res.end(body);
      };
      // @ts-ignore
      res._header = () => {};

      /////////////////////////////
      /////////////////////////////
      /////////////////////////////

      let resolved = false;
      function resolveResponse() {
        if (resolved) return;
        resolved = true;
        resolve(
          // @ts-ignore
          new Response(
            // @ts-ignore
            responseStatus === 304
              ? null
              : (Readable.toWeb(res) as ReadableStream),
            { headers: responseHeaders, status: responseStatus }
          )
        );
      }

      // @ts-ignore
      middleware(ctx.platform.request, res, () => {
        resolve();
      });
    });
  };
}
