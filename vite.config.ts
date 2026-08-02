/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Stage 1 of the D1 test strategy (see docs/adr/0004): worker/db
      // tests run against a node:sqlite shim here by default. The same
      // files run against real workerd/D1 via `npm run test:workers`
      // (worker/db/vitest.config.ts), which aliases this to the D1 binding
      // instead.
      "#test-db": fileURLToPath(new URL("./worker/db/testing/get-test-db.local.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts"],
  },
});
