import { defineConfig } from "vite";

export default defineConfig({
  base: "/annous-warfare/",
  build: {
    rollupOptions: {
      input: { main: "index.html", animation: "animation-preview.html" },
    },
  },
});
