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
      res: null,
      writer: null,
      encoder: null,
    });

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

      async function close() {
        store.closed = true;
        await store.writer.ready;
        await store.writer.close();
      }

      async function write(data) {
        let encoded;

        if (typeof data === "object") {
          encoded = data;
        } else {
          encoded = store.encoder.encode(data);
        }
        await store.writer.ready;

        const chunkSize = 1024;
        for (let start = 0; start < encoded.length; start += chunkSize) {
          const end = Math.min(start + chunkSize, encoded.length);
          const view = new Uint8Array(encoded.slice(start, end));
          await store.writer.write(view);
        }
      }
      store.res.status = (status: number) => (store.responseStatus = status);
      store.res.setHeader = (key: string, value: string) => {
        store.responseHeaders[key] = value;
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

      store.res.on = () => {};
      store.res.once = () => {};
      store.res.emit = async (...args) => {
        if (args[0] === "pipe") {
          resolveResponse();
        }
      };
      store.res._header = () => {};

      function resolveResponse() {
        resolve(
          new Response(
            store.responseStatus === 304 ? null : store.res.readable,
            {
              headers: store.responseHeaders,
              status: store.responseStatus,
            }
          )
        );
      }

      //TODO: ctx.platform.request is not exactly the express request, and only works on node
      middleware(ctx.platform.request, store.res, () => {
        resolve(ctx.next());
      });
    });
  };
}
