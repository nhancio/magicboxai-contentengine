import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../shared"),
      // Generated Convex API (types + function refs) from packages/backend.
      "@convex": path.resolve(__dirname, "../../packages/backend/convex"),
      // Use the eval-free lottie build. The full lottie-web build uses direct
      // eval() for After-Effects expressions (build warning + CSP/minify risk);
      // the light build renders normal animations fine and drops only
      // expressions, which our loaders don't use.
      "lottie-web": "lottie-web/build/player/lottie_light",
    },
  },
  server: { port: 8174, host: true, strictPort: true },
  build: {
    // Split heavy vendors into their own cacheable chunks so the entry stays
    // small and route-only libs (charts/remotion/lottie) load on demand.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@firebase") || id.includes("/firebase/")) return "firebase";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("remotion")) return "remotion";
          if (id.includes("lottie")) return "lottie";
          if (id.includes("@radix-ui")) return "radix";
          if (
            id.includes("/react-router") ||
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
