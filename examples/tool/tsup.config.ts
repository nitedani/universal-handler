import { defineConfig } from "tsup";
import universalMiddleware from "universal-middleware/esbuild";

export default defineConfig([
  {
    entry: {
      dummy: "./src/handlers/handler.ts",
      "middlewares/context": "./src/middlewares/context.middleware.ts",
      "middlewares/headers": "./src/middlewares/headers.middleware.ts",
    },
    format: ["esm"],
    platform: "neutral",
    target: "es2022",
    dts: true,
    esbuildPlugins: [universalMiddleware()],
    esbuildOptions(opts) {
      opts.outbase = "src";
    },
    bundle: true,
  },
]);
