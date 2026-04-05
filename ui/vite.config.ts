import * as path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 48300,
    proxy: {
      "/api": {
        target: "http://localhost:48310",
      },
      "/ws": {
        target: "http://localhost:48310",
        ws: true,
      },
    },
  },
});
