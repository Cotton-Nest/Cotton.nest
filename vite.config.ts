import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { PUBLIC_SUBROUTES, ROUTE_SEO_MAP } from './src/data/seoRoutes.ts';

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cottonNestRouteHtmlPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cotton-nest-route-html',
    apply: 'build',
    configResolved(resolvedConfig) {
      outDir = resolvedConfig.build.outDir || 'dist';
    },
    closeBundle() {
      const distRoot = path.resolve(import.meta.dirname, outDir);
      const baseHtmlPath = path.join(distRoot, 'index.html');
      if (!fs.existsSync(baseHtmlPath)) return;

      const baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');

      for (const routeSlug of PUBLIC_SUBROUTES) {
        const meta = ROUTE_SEO_MAP[routeSlug];
        const safeTitle = escapeHtmlAttr(meta.title);
        const safeDesc = escapeHtmlAttr(meta.description);
        const safeCanonical = escapeHtmlAttr(meta.canonical);

        let routeHtml = baseHtml
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${safeDesc}" />`
          )
          .replace(
            /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
            `<link rel="canonical" href="${safeCanonical}" />`
          )
          .replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${safeTitle}" />`
          )
          .replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${safeDesc}" />`
          )
          .replace(
            /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:url" content="${safeCanonical}" />`
          )
          .replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${safeTitle}" />`
          )
          .replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:description" content="${safeDesc}" />`
          );

        if (!meta.preloadHeroImage) {
          routeHtml = routeHtml.replace(
            /\s*<link\b[^>]*rel=["']preload["'][^>]*hero_cotton_nest_bedding[^>]*\/?>/gi,
            ''
          );
        }

        const routeDir = path.join(distRoot, routeSlug);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.writeFileSync(path.join(routeDir, 'index.html'), routeHtml, 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'Cotton Nest — Luxury Bed Linens',
          short_name: 'Cotton Nest',
          description: 'Premium 100% pure cotton bedsheets crafted for everyday comfort and modern luxury in Gurgaon, Haryana.',
          theme_color: '#8C2E46',
          background_color: '#FAF7F2',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/sitemap\.xml$/i,
            /^\/robots\.txt$/i,
            new RegExp(`^\\/(?:${PUBLIC_SUBROUTES.join('|')})(?:\\/.*)?$`, 'i'),
            /\/[^/?]+\.[^/]+$/,
          ],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/AdminPanel-*.js', '**/AnalyticsView-*.js', '**/PhotoUploadModal-*.js', '**/assets/aistudio/**'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:webp|png|jpg|jpeg|svg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-runtime-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
      cottonNestRouteHtmlPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
