import { testRun } from "./.testRun";

testRun("pnpm run prod:elysia", 23107, {
  doNotFailOnWarning: true,
});
