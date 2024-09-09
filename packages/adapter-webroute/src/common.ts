import type { RequestCtx } from "@webroute/route";
import type {
  Get,
  UniversalHandler,
  UniversalMiddleware,
} from "@universal-middleware/core";
import { getAdapterRuntime } from "@universal-middleware/core";
import type { DataResult, MiddlewareFn } from "@webroute/middleware";

export type WebrouteMiddleware<
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  InContext extends object = {},
  // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
  TResult extends DataResult | void = void,
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
  THeaders = unknown,
  TState extends InContext = InContext,
  TProviders = unknown,
> = MiddlewareFn<
  TResult,
  [ctx: RequestCtx<TParams, TQuery, TBody, THeaders, TState, TProviders>]
>;

export type WebrouteHandler<
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  InContext extends object = {},
  // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
  TResult extends DataResult | void = void,
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
  THeaders = unknown,
  TState extends InContext = InContext,
  TProviders = unknown,
> = WebrouteMiddleware<
  InContext,
  TResult,
  TParams,
  TQuery,
  TBody,
  THeaders,
  TState,
  TProviders
>;

/**
 * Creates a request handler to be passed to app.all() or any other route function
 */
export function createHandler<
  T extends unknown[],
  InContext extends Universal.Context,
>(
  handlerFactory: Get<T, UniversalHandler>,
): Get<T, WebrouteHandler<InContext>> {
  return (...args) => {
    const handler = handlerFactory(...args);

    return (request, ctx) => {
      const context = initContext(ctx);
      return handler(request, context, getAdapterRuntime("other", {}));
    };
  };
}

// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
type ExtractVoid<T, U> = T extends U ? T : void;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type MiddlewareFactoryReturnType<T extends (...args: any) => any> =
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ReturnType<T> extends UniversalMiddleware<any, any>
    ? Awaited<ReturnType<ReturnType<T>>>
    : never;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type MiddlewareFactoryDataResult<T extends (...args: any) => any> =
  ExtractVoid<MiddlewareFactoryReturnType<T>, DataResult>;

/**
 * Creates a middleware to be passed to app.use() or any route function
 */
export function createMiddleware<
  T extends unknown[],
  InContext extends Universal.Context,
  OutContext extends Universal.Context,
>(
  middlewareFactory: Get<T, UniversalMiddleware<InContext, OutContext>>,
): Get<
  T,
  WebrouteMiddleware<
    InContext,
    MiddlewareFactoryDataResult<typeof middlewareFactory>
  >
> {
  return (...args) => {
    const middleware = middlewareFactory(...args);

    return ((request, ctx) => {
      const context = initContext(ctx);
      return middleware(request, context, getAdapterRuntime("other", {}));
    }) as WebrouteMiddleware<
      InContext,
      MiddlewareFactoryDataResult<typeof middlewareFactory>
    >;
  };
}

function initContext<Context extends Universal.Context = Universal.Context>(
  ctx: RequestCtx<unknown, unknown, unknown, unknown, Context>,
): Context {
  ctx.state ??= {} as Context;
  return ctx.state;
}
