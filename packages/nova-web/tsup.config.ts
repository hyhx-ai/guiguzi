import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22",
  splitting: false,
  onSuccess: "node -e \"const p=require('node:path'),f=require('node:fs');f.copyFileSync(p.join('src','console.html'),p.join('dist','console.html'))\"",
});
