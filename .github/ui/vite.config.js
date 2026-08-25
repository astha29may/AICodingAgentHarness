var _a;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// The web app talks to the harness backend over /api (REST snapshot + SSE stream).
// In dev, Vite proxies those calls to the Node server so everything runs on one origin.
var API_TARGET = (_a = process.env.HARNESS_API_TARGET) !== null && _a !== void 0 ? _a : "http://localhost:3001";
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
