import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@supabase/supabase-js": fileURLToPath(
        new URL("./fake-supabase.js", import.meta.url),
      ),
    },
  },
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
});
