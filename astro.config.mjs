// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteUrl } from './src/lib/config.ts';
import { isNoindexPath } from './src/lib/urls.ts';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !isNoindexPath(new URL(page).pathname) })],
  // Geist is downloaded at build time and served from the site itself.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Geist',
      cssVariable: '--font-geist',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
});
