// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Add a development proxy so the local OAuth initiate path is forwarded to Supabase
  // This makes the "Continue with Google" button work during local dev by proxying
  // /~oauth/initiate?provider=google&redirect_uri=... -> https://<supabase>/auth/v1/authorize?provider=google&redirect_to=...
  vite: {
    server: {
      proxy: {
        '/~oauth/initiate': {
          target: SUPABASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/~oauth\/initiate/, '/auth/v1/authorize'),
        },
      },
    },
  },
});
