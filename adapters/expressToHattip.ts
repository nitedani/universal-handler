//@ts-nocheck

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
    if (ctx.resolved) {
      return ctx.resolved;
    }

    return new Promise<Response | void>((resolve) => {
      const responseHeaders: Record<string, string> = {};
      let responseStatus = 200;
      const res = (ctx.res ??= new Proxy(new TransformStream(), {
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
      }));

      function close() {
        return new Promise((resolve, reject) => {
          writer.ready
            .then(() => {
              writer.close().then(resolve).catch(reject);
            })
            .catch(reject);
        });
      }

      const writer = (ctx.writer ??= ctx.res.writable.getWriter());
      const encoder = (ctx.encoder ??= new TextEncoder());

      async function write(...args) {
        return new Promise<void>((resolve, reject) => {
          const encoded = encoder.encode(...args);
          encoded.forEach((chunk, idx) => {
            writer.ready
              .then(() => {
                const view = new Uint8Array(1);
                view[0] = chunk;
                writer
                  .write(view)
                  .then(() => {
                    if (idx === encoded.length - 1) {
                      resolve();
                    }
                  })
                  .catch(reject);
              })
              .catch(reject);
          });
        });
      }

      res.status = (status: number) => (responseStatus = status);
      res.setHeader = (key: string, value: string) => {
        responseHeaders[key] = value;
        //TODO: this only works on node
        ctx.platform.response.setHeader(key, value);
      };
      res.getHeader = (key: string) => responseHeaders[key];
      res.removeHeader = (key: string) => delete responseHeaders[key];
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
        write(...args);
      };
      res.end = async (...args) => {
        resolveResponse();
        if (typeof args[0] !== "function") {
          await write(args[0]);
        }
        close();
      };
      res.send = async (body: string) => {
        resolveResponse();
        await write(body);
        close();
      };
      res._header = () => {};

      function resolveResponse() {
        if (ctx.resolved) return;
        ctx.resolved = new Response(
          responseStatus === 304 ? null : ctx.res.readable,
          {
            headers: responseHeaders,
            status: responseStatus,
          }
        );
        resolve(ctx.resolved);
      }

      //TODO: this only works on node
      middleware(ctx.platform.request, ctx.res, () => {
        resolve();
      });
    });
  };
}
