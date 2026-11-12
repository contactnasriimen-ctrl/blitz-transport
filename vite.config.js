import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
// GitHub Pages preview build (npm run deploy): sub-folder, not indexed, no PHP.
const BASE = process.env.BASE || '/';
const PREVIEW = !!process.env.PREVIEW;
const cfg = () => {
  const c = JSON.parse(readFileSync(resolve(root, 'site.config.json'), 'utf8'));
  if (process.env.SITE_URL) c.siteUrl = process.env.SITE_URL;
  return c;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replaces %%key%% tokens with values from site.config.json (HTML pages + server files). */
function siteData() {
  const fill = (text, escape = true) => {
    const c = cfg();
    return text.replace(/%%([a-zA-Z]+)%%/g, (m, k) => {
      if (!(k in c)) throw new Error(`site.config.json: unbekannter Schlüssel ${k}`);
      return escape ? esc(c[k]) : String(c[k]);
    });
  };
  return {
    name: 'blitz-site-data',
    transformIndexHtml: { order: 'pre', handler: (html) => fill(html) },
    generateBundle() {
      const c = cfg();
      const php = readFileSync(resolve(root, 'server/contact.php'), 'utf8');
      if (!PREVIEW) this.emitFile({ type: 'asset', fileName: 'contact.php', source: fill(php, false) });
      const base = c.siteUrl.replace(/\/$/, '');
      const today = new Date().toISOString().slice(0, 10);
      const urls = ['/', '/impressum.html', '/datenschutz.html'];
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod></url>`)
          .join('\n')}\n</urlset>\n`,
      });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n` });
    },
  };
}

/**
 * Speed (build only): inline the CSS (no render-blocking request), preload the two
 * fonts of the first screen and the poster image, prefetch the 3D chunk.
 */
function speed() {
  return {
    name: 'blitz-speed',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle || {};
        const files = Object.keys(bundle);
        html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g, (m, href) => {
          const asset = bundle[href.slice(BASE.length)];
          return asset ? `<style>${String(asset.source)}</style>` : m;
        });
        const tags = [];
        const isHome = ctx.path === '/index.html';
        const fonts = isHome ? ['barlow-condensed-latin-800-italic', 'barlow-latin-400-normal'] : ['barlow-condensed-latin-800-italic'];
        for (const f of fonts) {
          const file = files.find((n) => n.includes(f) && n.endsWith('.woff2'));
          if (file) tags.push(`<link rel="preload" href="${BASE}${file}" as="font" type="font/woff2" crossorigin>`);
        }
        if (isHome) {
          tags.push(`<link rel="preload" href="${BASE}poster-wide.webp" as="image" media="(min-aspect-ratio: 1/1)" fetchpriority="high">`);
          tags.push(`<link rel="preload" href="${BASE}poster-tall.webp" as="image" media="(max-aspect-ratio: 1/1)" fetchpriority="high">`);
          const scene = Object.values(bundle).find((c) => c.type === 'chunk' && c.facadeModuleId && c.facadeModuleId.replace(/\\/g, '/').endsWith('src/scene/index.js'));
          if (scene) tags.push(`<link rel="prefetch" href="${BASE}${scene.fileName}" as="script">`);
        }
        html = html.replace('</title>', `</title>\n    ${tags.join('\n    ')}`);
        if (BASE !== '/') {
          // root-absolute links (/impressum.html, /favicon.svg, url(/poster…)) → sub-folder
          const sub = BASE.slice(1);
          html = html.replace(/((?:href|src|action)=")\/(?!\/)/g, (m, a, i, all) => (all.startsWith(sub, i + m.length) ? m : a + BASE));
          html = html.replace(/(url\(['"]?)\/(?!\/)/g, (m, a, i, all) => (all.startsWith(sub, i + m.length) ? m : a + BASE));
        }
        if (PREVIEW) html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow" />');
        return html;
      },
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [siteData(), speed()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        impressum: resolve(root, 'impressum.html'),
        datenschutz: resolve(root, 'datenschutz.html'),
      },
    },
  },
  server: { port: 5181 },
});
