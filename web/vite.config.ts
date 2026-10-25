import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// La API PHP corre en otro puerto en desarrollo; en producción vive en /api del mismo dominio
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: false,
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': la app avisa cuando hay versión nueva en lugar de recargarse a media captura
      registerType: 'prompt',
      pwaAssets: {
        image: 'public/favicon.svg',
        preset: 'minimal-2023',
        overrideManifestIcons: true,
      },
      manifest: {
        name: 'Diagnóstico de Monitores',
        short_name: 'Monitores',
        description: 'Inventario y diagnóstico de monitores de signos vitales',
        lang: 'es-MX',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
      },
      workbox: {
        // manifest.webmanifest no va aquí: el plugin ya lo agrega (duplicarlo rompe el precache)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,wasm}'],
        // Los chunks de PDF/Excel y el lector de códigos pesan más de 2 MB
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Las fotos ya subidas quedan disponibles sin conexión una vez vistas
            urlPattern: ({ url }) => url.pathname.startsWith('/api/photos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'monitor-photos',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
