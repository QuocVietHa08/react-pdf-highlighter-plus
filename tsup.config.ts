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
    // Copy CSS files to dist/esm/style
    const srcStyleDir = "src/style";
    const destStyleDir = "dist/esm/style";

    mkdirSync(destStyleDir, { recursive: true });

    const files = readdirSync(srcStyleDir);
    for (const file of files) {
      if (file.endsWith(".css")) {
        copyFileSync(join(srcStyleDir, file), join(destStyleDir, file));
      }
    }
    console.log("✓ CSS files copied to dist/esm/style");
  },
});
