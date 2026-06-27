// @ts-check
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load test environment variables
dotenv.config({ path: resolve(__dirname, ".env.test") });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-test-project")) {
  console.error("🚨 INTEGRATION TESTS ABORTED: Missing valid TEST configuration in .env.test");
  console.error("Please configure .env.test with a dedicated testing Supabase project.");
  process.exit(1);
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/services/__tests__/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./src/services/__tests__/integration/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
