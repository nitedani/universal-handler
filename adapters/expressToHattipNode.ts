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
    const store = (ctx.locals._expressToHattip ??= {});
    store.p ||= new PassThrough();
    store.originalEnd ||= store.p.end.bind(store.p);
    store.originalWrite ||= store.p.write.bind(store.p);
    store.originalEmit ||= store.p.emit.bind(store.p);

    return new Promise<Response | void>((resolve) => {
      store.p.emit = (...args) => {
        if (args[0] === "pipe") {
          resolveResponse();
        }
        store.originalEmit(...args);
      };
      store.res ||= new Proxy(
        Object.assign(store.p, {
          headers: {},
          statusCode: 200,
          _header: () => {},
          status: (status: number) => {
            store.res.statusCode = status;
          },
          setHeader: (key: string, value: string) => {
            store.res.headers[key] = value;
          },
          getHeader: (key: string) => store.res.headers[key],
          removeHeader: (key: string) => delete store.res.headers[key],
          write: (...args) => {
            resolveResponse();
            return store.originalWrite(...args);
          },
          send: (...args) => {
            return store.res.end(...args);
          },
          end: async (...args) => {
            resolveResponse();
            return store.originalEnd(...args);
          },
        }),
        {
          get(target, prop) {
            if (
              [
                "headers",
                "statusCode",
                "status",
                "setHeader",
                "getHeader",
                "removeHeader",
                "send",
                "end",
                "emit",
                "_events",
                "destroy",

                "write",

                "Symbol(kCallback)",
              ].includes(prop.toString())
            ) {
              return Reflect.get(target, prop);
            }
            if (prop in ctx.platform.response) {
              return ctx.platform.response[prop];
            }
            return Reflect.get(target, prop);
          },
          set(target, p, newValue, receiver) {
            if (["headers", "statusCode", "end", "send"].includes(p)) {
              return Reflect.set(target, p, newValue, receiver);
            } else {
              ctx.platform.response[p] = newValue;
            }

            return true;
          },
        }
      );

      function resolveResponse() {
        resolve(
          new Response(
            store.res.statusCode === 304 ? null : Readable.toWeb(store.res),
            {
              headers: store.res.headers,
              status: store.res.statusCode,
            }
          )
        );
      }

      middleware(ctx.platform.request, store.res, () => {
        resolve(ctx.next());
      });
    });
  };
}
