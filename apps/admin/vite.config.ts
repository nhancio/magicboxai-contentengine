import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
      "firebase/functions",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
      "@radix-ui/react-dialog",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../shared"),
    },
  },
  server: { port: 5175, host: true },
});
