import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/manifests.ts",
      formats: ["es"],
      fileName: "content-calendar",
    },
    // Copied into each edition's wwwroot/App_Plugins/ContentCalendar by ContentCalendar.Backoffice.targets.
    // The watch:v17 / watch:v18 scripts override this to write straight into an edition while developing.
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // The backoffice provides these at runtime; FullCalendar is bundled.
      external: [/^@umbraco/],
    },
  },
});
