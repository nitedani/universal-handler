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
    const store = (ctx.locals._expressToHattip ??= {
      responseStatus: 200,
      responseHeaders: {},
      closed: false,
      resolved: null,
      res: null,
      writer: null,
      encoder: null,
      resolvedResponse: null,
    });
    

    if (store.closed && store.resolvedResponse) {
      return store.resolvedResponse;
    }

    return new Promise<Response | void>((resolve) => {
      store.res ||= new Proxy(new TransformStream(), {
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
      store.writer ||= store.res.writable.getWriter();
      store.encoder ||= new TextEncoder();

      function close() {
        store.closed = true;
        return new Promise((resolve, reject) => {
          store.writer.ready
            .then(() => {
              store.writer.close().then(resolve).catch(reject);
            })
            .catch(reject);
        });
      }

      function write(chunk) {
        return new Promise<void>((resolve, reject) => {
          const encoded = store.encoder.encode(chunk);
          encoded.forEach((chunk, idx) => {
            store.writer.ready
              .then(() => {
                const view = new Uint8Array(1);
                view[0] = chunk;
                store.writer
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
        }
      };
      store.res.write = async (...args) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        resolveResponse();
        await write(...args);
        const callback = args[args.length - 1];
        if (typeof callback === "function") {
          callback();
        }
      };
      store.res.end = async (...args) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        store.closed = true;
        resolveResponse();
        if (args[0] && typeof args[0] !== "function") {
          await write(args[0]);
        }
        await close();
        const callback = args[args.length - 1];
        if (typeof callback === "function") {
          callback();
        }
      };
      store.res.send = async (body: string) => {
        if (store.closed) {
          console.warn("The response is already sent");
          return;
        }
        store.closed = true;
        resolveResponse();
        await write(body);
        await close();
      };
      store.res._header = () => {};

      function resolveResponse() {
        store.resolvedResponse ??= new Response(
          store.resolvedResponse ??
            (store.responseStatus === 304 ? null : store.res.readable),
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
