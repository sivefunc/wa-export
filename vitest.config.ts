import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Rendered times are local; pin the zone so expectations are deterministic (UTC-6, no DST).
    env: { TZ: "Etc/GMT+6" },
  },
});
