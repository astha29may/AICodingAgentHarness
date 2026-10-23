import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The web app talks to the harness backend over /api (REST snapshot + SSE stream).
// In dev, Vite proxies those calls to the Node server so everything runs on one origin.
const API_TARGET = process.env.HARNESS_API_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
