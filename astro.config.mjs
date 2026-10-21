import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The site's origin. It is also in public/robots.txt (the Sitemap line) and,
// once a custom domain exists, in wrangler.jsonc (the route).
export default defineConfig({
  site: 'https://bottega-kit-sh.8004dev.workers.dev',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
