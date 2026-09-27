import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/manifests.ts",
      formats: ["es"],
      fileName: "content-calendar",
    },
    outDir: "../wwwroot/App_Plugins/ContentCalendar",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // The backoffice provides these at runtime; FullCalendar is bundled.
      external: [/^@umbraco/],
    },
  },
});
