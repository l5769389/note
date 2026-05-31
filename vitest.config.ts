import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      all: true,
      exclude: [
        "src/main/**",
        "src/preload/**",
        "src/renderer/src/main.tsx",
        "src/renderer/src/vite-env.d.ts",
        "src/renderer/src/types.ts",
        "src/renderer/src/App.tsx",
        "src/renderer/src/components/**",
        "src/renderer/src/exportDocument.tsx",
        "src/renderer/src/excalidrawLibraries.ts",
        "src/renderer/src/mermaid.ts",
        "src/renderer/src/syntaxHighlighting.ts",
      ],
      include: ["src/renderer/src/**/*.{ts,tsx}", "src/shared/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 60,
        statements: 60,
      },
    },
  },
});
