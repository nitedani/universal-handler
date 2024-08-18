import type { Get, UniversalMiddleware } from "universal-middleware";

const headersMiddleware: Get<[], UniversalMiddleware<{ something?: string }>> =
  () => (_request, ctx) => {
    return (response) => {
      response.headers.set("X-Custom-Header", ctx.something ?? "NONE");

      return response;
    };
  };

export default headersMiddleware;
