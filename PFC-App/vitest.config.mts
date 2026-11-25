import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  // Tests are logic-only; skip the app's Tailwind PostCSS pipeline.
  css: { postcss: {} },
  test: {
    include: ["src/**/*.test.ts"],
    // Service tests share one libSQL file per worker; keep files isolated.
    fileParallelism: false,
  },
});
