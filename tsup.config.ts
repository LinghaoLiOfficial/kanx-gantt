import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["react", "react-dom", "@svar-ui/react-gantt"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
