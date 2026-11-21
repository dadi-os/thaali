import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";
import { LIVE_HOSTS, liveAllowed } from "./src/dev/liveAllow.ts";

/**
 * The dev server the visual loop screenshots: the app's own config with the host list and
 * Tauri-era hot-reload port removed, so it serves plain localhost with a working client. It also proxies `/__live/<host>/…` to the real
 * Yaad and Hath for `?fixtures=live`, answering 404 to anything that is not a read (see `src/dev/liveAllow.ts`).
 */
export default defineConfig((env) =>
  mergeConfig(base(env), {
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      hmr: false,
      proxy: Object.fromEntries(
        LIVE_HOSTS.map((host) => [
          `/__live/${host}`,
          {
            target: `http://${host}.dadi`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(`/__live/${host}`, ""),
            bypass: (req: { method?: string; url?: string }) => (liveAllowed(host, req.method ?? "", (req.url ?? "").replace(`/__live/${host}`, "")) ? undefined : false),
          },
        ]),
      ),
    },
  }),
);
