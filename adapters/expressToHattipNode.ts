//@ts-nocheck
import { PassThrough, Readable } from "stream";
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
    const store = (ctx.locals._expressToHattip ??= {
      responseStatus: 200,
      responseHeaders: {},
      closed: false,
      res: null,
      resolvedResponse: null,
      originalWrite: null,
      originalEnd: null,
    });

    return new Promise<Response | void>((resolve) => {
      store.res ||= new Proxy(new PassThrough(), {
        get(target, prop) {
          if (prop === "headers") {
            return store.responseHeaders;
          }
          if (prop === "statusCode") {
            return store.responseStatus;
          }
          return Reflect.get(target, prop);
        },
        set(target, p, newValue, receiver) {
          if (p === "statusCode") {
            store.responseStatus = newValue;
          } else {
            return Reflect.set(target, p, newValue, receiver);
          }
          return true;
        },
      });

      store.originalWrite ||= store.res.write.bind(store.res);
      store.originalEnd ||= store.res.end.bind(store.res);

      store.res.status = (status: number) => (store.responseStatus = status);
      store.res.setHeader = (key: string, value: string) => {
        store.responseHeaders[key] = value;
        // TODO: this only works on node
        // either do this, or need to wrap hattip .use() to modify the response headers of a hattip handler that returns a Response directly
        ctx.platform.response.setHeader(key, value);
      };
      store.res.getHeader = (key: string) => store.responseHeaders[key];
      store.res.removeHeader = (key: string) =>
        delete store.responseHeaders[key];
      store.res.writeHead = (
        status_: number,
        headersOrMessage?: Record<string, string> | string
      ) => {
        store.responseStatus = status_;
        if (typeof headersOrMessage === "object") {
          Object.assign(store.responseHeaders, headersOrMessage);
          for (const [key, value] of Object.entries(headersOrMessage)) {
            ctx.platform.response.setHeader(key, value);
          }
        }
      };
      store.res.write = async (...args) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        resolveResponse();
        return store.originalWrite(...args);
      };

      store.res.end = async (...args) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        store.closed = true;
        resolveResponse();
        return store.originalEnd(...args);
      };
      store.res.send = async (...args) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        store.closed = true;
        resolveResponse();
        return store.originalEnd(...args);
      };
      store.res._header = () => {};

      function resolveResponse() {
        store.resolvedResponse ??= new Response(
          store.resolvedResponse ??
            (store.responseStatus === 304 ? null : Readable.toWeb(store.res)),
          {
            headers: store.responseHeaders,
            status: store.responseStatus,
          }
        );

        resolve(store.resolvedResponse);
      }

      //TODO: ctx.platform.request is not exactly the express request, and only works on node
      middleware(ctx.platform.request, store.res, () => {
        resolve();
      });
    });
  };
}
