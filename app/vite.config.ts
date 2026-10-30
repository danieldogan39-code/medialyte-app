import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// base "./": dieselben Dateien laufen im Browser (app.medialyte.de), im Mac-/Windows-Programm und in der Android-App
export default defineConfig({
  base: "./",
  plugins: [svelte()],
  build: { target: "es2022", outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { port: 5173, strictPort: true },
});
