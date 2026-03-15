import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../shared"),
      // Force resolution from app node_modules when shared code imports these
      "class-variance-authority": path.resolve(__dirname, "node_modules/class-variance-authority"),
      "@radix-ui/react-slot": path.resolve(__dirname, "node_modules/@radix-ui/react-slot"),
      "clsx": path.resolve(__dirname, "node_modules/clsx"),
      "tailwind-merge": path.resolve(__dirname, "node_modules/tailwind-merge"),
    },
  },
  server: { port: 5173, host: true },
});
