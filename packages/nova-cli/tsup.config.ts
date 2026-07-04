import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/render.tsx"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22",
  splitting: false,
  external: [/^@novaclaw\//, "react", "ink"],
  jsx: "automatic",
});
