import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist/esm",
  external: ["react", "react-dom", "pdfjs-dist"],
  esbuildOptions(options) {
    options.jsx = "transform";
  },
});
