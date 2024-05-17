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
      writing: Promise.resolve(),
      originalEmit: null,
    });

    return new Promise<Response | void>((resolve) => {
      store.res ||= new Proxy(new MyResponse(), {
        get(target, prop) {
          if (prop === "headers") {
            return store.responseHeaders;
          }
          if (prop === "statusCode") {
            return store.responseStatus;
          }
          if (prop === "headersSent") {
            return store.closed;
          }
          if (prop === "finished") {
            return store.closed;
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
      store.originalEmit ||= store.res.emit.bind(store.res);
      async function close() {
        store.closed = true;
        await store.writer.ready;
        await store.writer.close();
        store.res.emit("finish");
        store.res.emit("end");
      }

      async function write(data) {
        let encoded;

        let writingEnded = () => {};
        store.writing = new Promise((resolve) => {
          writingEnded = resolve;
        });
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
        writingEnded();
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
        await store.writing;
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

      store.res.emit = async (...args) => {
        if (args[0] === "pipe") {
          resolveResponse();
        }
        store.originalEmit(...args);
      };
      store.res._header = () => {};

      function resolveResponse() {
        if (store.resolvedResponse) {
          // Response body object should not be disturbed
          return;
        }
        resolve(
          (store.resolvedResponse = new Response(
            store.responseStatus === 304 ? null : store.res.readable,
            {
              headers: store.responseHeaders,
              status: store.responseStatus,
            }
          ))
        );
      }

      middleware(ctx.platform.request, store.res, () => {
        resolve(ctx.next());
      });
    });
  };
}
class MyResponse extends TransformStream {
  listeners = {};
  emit(eventName, ...data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((listener) => {
        setTimeout(() => {
          listener.callback.apply(this, data);
        }, 0);

        if (listener.once) {
          this.off(eventName, listener.callback);
        }
      });
    }
  }

  on(name, callback) {
    this.addListener(name, callback);
  }

  once(name, callback) {
    if (typeof callback === "function" && typeof name === "string") {
      if (!this.listeners[name]) {
        this.listeners[name] = [];
      }
      this.listeners[name].push({ callback, once: true });
    }
  }

  addListener(name, callback) {
    if (typeof callback === "function" && typeof name === "string") {
      if (!this.listeners[name]) {
        this.listeners[name] = [];
      }
      this.listeners[name].push({ callback, once: false });
    }
  }

  off(eventName, callback) {
    this.removeListener(eventName, callback);
  }

  removeListener(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(
        (listener) => listener.callback !== callback
      );
    }
  }

  destroy() {
    this.listeners = {};
  }
}
