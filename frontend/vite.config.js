import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/pruebas/setup.js"],
    css: false,
    // userEvent escribe carácter por carácter y los formularios largos se
    // acercan al limite de 5 s por defecto. Con la maquina cargada llegaban a
    // pasarlo y la suite fallaba por timeout, no por un error real.
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // La catedra exige 85% en el frontend. El umbral esta puesto para que
      // `npm run test:coverage` falle si bajamos de ahi, no como aspiracion.
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/main.jsx",
        "src/App.jsx", // sólo cablea rutas; se ejercita desde las pantallas
        "src/pruebas/**",
        "src/componentes/ui/**", // primitivas de Radix, se testean via las pantallas
        "src/layouts/**",
        "**/*.test.{js,jsx}",
        "**/*.config.js",
      ],
    },
  },
});
