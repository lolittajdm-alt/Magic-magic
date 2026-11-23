import { defineConfig, loadEnv } from "vite";
import { createPaymentApi } from "./server/payments.js";
import { createNovaPoshtaApi } from "./server/nova-poshta.js";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = createNovaPoshtaApi(env.NOVA_POSHTA_API_KEY);
  const payments = createPaymentApi({
    token: env.MONO_API_TOKEN,
    origin: env.APP_ORIGIN || "http://127.0.0.1:5173",
  });
  return {
    resolve: { alias: { "react-native": "react-native-web" } },
    plugins: [
      {
        name: "nova-poshta-server",
        configureServer(server) {
          server.middlewares.use(payments);
          server.middlewares.use(api);
        },
        configurePreviewServer(server) {
          server.middlewares.use(payments);
          server.middlewares.use(api);
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: {
        deny: [
          ".env",
          ".env.*",
          "**/.git/**",
          "**/server/**",
          "**/.data/**",
          "**/*.{crt,pem}",
        ],
      },
    },
  };
});
