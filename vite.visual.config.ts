import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";

/**
 * The dev server the visual loop screenshots: the app's own config with the host list and
 * Tauri-era hot-reload port removed, so it serves plain localhost with a working client.
 */
export default defineConfig((env) =>
  mergeConfig(base(env), {
    server: { host: "127.0.0.1", port: 5174, strictPort: true, hmr: false },
  }),
);
