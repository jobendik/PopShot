import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs keep the built app portable across GitHub Pages
  // project sites, user sites, and local static hosting without needing the
  // repository name baked into the config.
  base: './',
  server: {
    host: true,   // listen on 0.0.0.0 — exposes LAN address for phone / tablet access
    port: 5173,
  },
});
