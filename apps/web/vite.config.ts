import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../shared"),
      // Shared code: force resolution from app node_modules
      "class-variance-authority": path.resolve(__dirname, "node_modules/class-variance-authority"),
      "clsx": path.resolve(__dirname, "node_modules/clsx"),
      "tailwind-merge": path.resolve(__dirname, "node_modules/tailwind-merge"),
      "firebase": path.resolve(__dirname, "node_modules/firebase"),
      "firebase/app": path.resolve(__dirname, "node_modules/firebase/app"),
      "firebase/auth": path.resolve(__dirname, "node_modules/firebase/auth"),
      "firebase/firestore": path.resolve(__dirname, "node_modules/firebase/firestore"),
      "firebase/storage": path.resolve(__dirname, "node_modules/firebase/storage"),
      "firebase/functions": path.resolve(__dirname, "node_modules/firebase/functions"),
      "@radix-ui/react-slot": path.resolve(__dirname, "node_modules/@radix-ui/react-slot"),
      "@radix-ui/react-label": path.resolve(__dirname, "node_modules/@radix-ui/react-label"),
      "@radix-ui/react-select": path.resolve(__dirname, "node_modules/@radix-ui/react-select"),
      "@radix-ui/react-dialog": path.resolve(__dirname, "node_modules/@radix-ui/react-dialog"),
      "@radix-ui/react-tabs": path.resolve(__dirname, "node_modules/@radix-ui/react-tabs"),
      "@radix-ui/react-avatar": path.resolve(__dirname, "node_modules/@radix-ui/react-avatar"),
      "@radix-ui/react-separator": path.resolve(__dirname, "node_modules/@radix-ui/react-separator"),
      "@radix-ui/react-dropdown-menu": path.resolve(__dirname, "node_modules/@radix-ui/react-dropdown-menu"),
      "@radix-ui/react-scroll-area": path.resolve(__dirname, "node_modules/@radix-ui/react-scroll-area"),
    },
  },
  server: { port: 5174, host: true },
});
