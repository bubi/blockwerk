/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts"],
    // worker/db tests run against real D1 only — see docs/adr/0004 and
    // `npm run test:workers` (worker/db/vitest.config.ts).
    exclude: ["node_modules/**", "worker/db/**"],
  },
});
