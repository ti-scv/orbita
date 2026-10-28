import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "non-blocking-panel-fonts",
      // Font CSS is optional for startup: an external timeout must not delay
      // the session request or the first paint. Keep the same fonts and swap.
      transform(source, id) {
        if (id.split("?")[0].endsWith("/src/styles.css")) {
          return source.replace(
            /@import url\("https:\/\/fonts\.googleapis\.com\/[^"\n]+"\);/g,
            "",
          );
        }
      },
      transformIndexHtml(html) {
        const styles = readFileSync(
          new URL("./src/styles.css", import.meta.url),
          "utf8",
        );
        const extra = styles.match(
          /@import url\("(https:\/\/fonts\.googleapis\.com\/[^"\n]+)"\);/,
        );
        const fontLink = (url: string) =>
          `<link rel="preload" as="style" href="${url.replaceAll("&", "&amp;")}" onload="this.onload=null;this.rel='stylesheet'" />`;
        return html
          .replace(
            /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/[^"\n]+)"[^>]+rel="stylesheet"[^>]*>/g,
            (_, url: string) => fontLink(url),
          )
          .replace("</head>", `${extra ? fontLink(extra[1]) : ""}\n</head>`);
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep shared React runtime out of the lazy chart chunk.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/")) return "charts";
        },
      },
    },
  },
});
