import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import packageInfo from "./package.json";

const buildStamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const [major, minor] = packageInfo.version.split(".");
const appVersion = process.env.APP_BUILD_VERSION || `${major}.${minor}.${buildStamp}`;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["pwa/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Local News Channel",
        short_name: "Local News",
        description: "Local stories and newsroom management in English and Chinese.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f2f3ef",
        theme_color: "#123a2d",
        categories: ["news", "productivity"],
        icons: [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        globPatterns: ["**/*.{html,js,css,svg,ico,woff,woff2}"],
        // User records, sessions, stories and uploads deliberately stay network-only.
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:4000" } },
});
