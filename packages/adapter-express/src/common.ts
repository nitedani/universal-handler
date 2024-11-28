import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type {
  Awaitable,
  Get,
  RuntimeAdapter,
  UniversalFn,
  UniversalHandler,
  UniversalMiddleware,
} from "@universal-middleware/core";
import { bindUniversal, getAdapterRuntime, universalSymbol } from "@universal-middleware/core";
import { type NodeRequestAdapterOptions, createRequestAdapter } from "./request.js";
import { sendResponse, wrapResponse } from "./response.js";

export const contextSymbol = Symbol.for("unContext");
export const requestSymbol = Symbol.for("unRequest");
export const pendingMiddlewaresSymbol = Symbol.for("unPendingMiddlewares");
export const wrappedResponseSymbol = Symbol.for("unWrappedResponse");
export const pendingWritesSymbol = Symbol.for("unPendingWrites");

export const env: Record<string, string | undefined> =
  typeof globalThis.process?.env !== "undefined"
    ? globalThis.process.env
    : typeof (import.meta as unknown as Record<"env", Record<string, string | undefined>>)?.env !== "undefined"
      ? (import.meta as unknown as Record<"env", Record<string, string | undefined>>).env
      : {};

export interface PossiblyEncryptedSocket extends Socket {
  encrypted?: boolean;
}

/**
 * `IncomingMessage` possibly augmented by Express-specific
 * `ip` and `protocol` properties.
 */
export interface DecoratedRequest<C extends Universal.Context = Universal.Context>
  extends Omit<IncomingMessage, "socket"> {
  ip?: string;
  protocol?: string;
  socket?: PossiblyEncryptedSocket;
  rawBody?: Buffer | null;
  originalUrl?: string;
  params?: Record<string, string>;
  [contextSymbol]?: C;
  [requestSymbol]?: Request;
}

export interface DecoratedServerResponse extends ServerResponse {
  [pendingMiddlewaresSymbol]?: ((response: Response) => Awaitable<Response>)[];
  [wrappedResponseSymbol]?: boolean;
  [pendingWritesSymbol]?: Promise<unknown>[];
}

/** Connect/Express style request listener/middleware */
export type NodeMiddleware<In extends Universal.Context, Out extends Universal.Context> = UniversalFn<
  UniversalMiddleware<In, Out>,
  <R>(req: DecoratedRequest<In>, res: DecoratedServerResponse, next?: (err?: unknown) => void) => R
>;
export type NodeHandler<In extends Universal.Context> = UniversalFn<
  UniversalHandler<In>,
  <R>(req: DecoratedRequest<In>, res: DecoratedServerResponse, next?: (err?: unknown) => void) => R
>;

/** Adapter options */
export interface NodeAdapterHandlerOptions extends NodeRequestAdapterOptions {}
export interface NodeAdapterMiddlewareOptions extends NodeRequestAdapterOptions {}

/**
 * Creates a request handler to be passed to http.createServer() or used as a
 * middleware in Connect-style frameworks like Express.
 */
export function createHandler<T extends unknown[], InContext extends Universal.Context>(
  handlerFactory: Get<T, UniversalHandler<InContext>>,
  options: NodeAdapterHandlerOptions = {},
): Get<T, NodeHandler<InContext>> {
  const requestAdapter = createRequestAdapter(options);

  return (...args) => {
    const handler = handlerFactory(...args);

    return bindUniversal(handler, async function universalHandlerExpress(req, res, next) {
      try {
        req[contextSymbol] ??= {} as InContext;
        const request = requestAdapter(req);
        const response = await this[universalSymbol](request, req[contextSymbol], getRuntime(req, res));

        await sendResponse(response, res);
      } catch (error) {
        if (next) {
          next(error);
        } else {
          console.error(error);

          if (!res.headersSent) {
            res.statusCode = 500;
          }

          if (!res.writableEnded) {
            res.end();
          }
        }
      }
    });
  };
}

/**
 * Creates a middleware to be passed to Connect-style frameworks like Express
 */
export function createMiddleware<
  T extends unknown[],
  InContext extends Universal.Context,
  OutContext extends Universal.Context,
>(
  middlewareFactory: Get<T, UniversalMiddleware<InContext, OutContext>>,
  options: NodeAdapterMiddlewareOptions = {},
): Get<T, NodeMiddleware<InContext, OutContext>> {
  const requestAdapter = createRequestAdapter(options);

  return (...args) => {
    const middleware = middlewareFactory(...args);

    return bindUniversal(middleware, async function universalMiddlewareExpress(req, res, next) {
      try {
        req[contextSymbol] ??= {} as InContext;
        const request = requestAdapter(req);
        const response = await this[universalSymbol](request, getContext(req), getRuntime(req, res));

        if (!response) {
          return next?.();
        }
        if (typeof response === "function") {
          if (res.headersSent) {
            throw new Error(
              "Universal Middleware called after headers have been sent. Please open an issue at https://github.com/magne4000/universal-middleware",
            );
          }
          wrapResponse(res);
          res[pendingMiddlewaresSymbol] ??= [];
          // `wrapResponse` takes care of calling those middlewares right before sending the response
          res[pendingMiddlewaresSymbol].push(response);
          return next?.();
        }
        if (response instanceof Response) {
          await sendResponse(response, res);
        } else {
          req[contextSymbol] = response as unknown as InContext;
          return next?.();
        }
      } catch (error) {
        if (next) {
          next(error);
        } else {
          console.error(error);

          if (!res.headersSent) {
            res.statusCode = 500;
          }

          if (!res.writableEnded) {
            res.end();
          }
        }
      }
    });
  };
}

export function getContext<InContext extends Universal.Context = Universal.Context>(req: DecoratedRequest): InContext {
  return req[contextSymbol] as InContext;
}

export function getRuntime(request: DecoratedRequest, response: DecoratedServerResponse): RuntimeAdapter {
  return getAdapterRuntime("express", {
    params: request.params,
    req: request as IncomingMessage,
    res: response,
  });
}
