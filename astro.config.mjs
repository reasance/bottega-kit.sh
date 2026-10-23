import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The site's origin. It is also in public/robots.txt (the Sitemap line), in
// wrangler.jsonc (the routes) and in BaseLayout.astro (the fallback).
export default defineConfig({
  site: 'https://bottega-kit.sh',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
