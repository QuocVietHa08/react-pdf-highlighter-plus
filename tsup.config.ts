import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

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
  onSuccess: async () => {
    const srcStyleDir = "src/style";
    const destStyleDir = "dist/esm/style";

    mkdirSync(destStyleDir, { recursive: true });

    const files = readdirSync(srcStyleDir);
    for (const file of files) {
      if (file.endsWith(".css")) {
        copyFileSync(join(srcStyleDir, file), join(destStyleDir, file));
      }
    }

    copyFileSync(
      "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
      "dist/esm/pdf.worker.min.mjs",
    );

    console.log("✓ CSS files and PDF.js worker copied to dist/esm");
  },
});
