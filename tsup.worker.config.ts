import { defineConfig } from "tsup";

export default defineConfig({
  // Single entry — tsup traces all imports from here
  entry: { index: "src/worker/index.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist-worker",
  // Bundle our source (resolves @/* aliases); keep all node_modules external.
  // tsup reads package.json dependencies and marks them external by default,
  // so bullmq, baileys, drizzle-orm, etc. stay as normal runtime imports —
  // no bundling issues with native addons or proto file dynamic loads.
  bundle: true,
  sourcemap: false,
  clean: true,
  tsconfig: "./tsconfig.worker.json",
});
