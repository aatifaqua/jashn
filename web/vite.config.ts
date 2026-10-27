/// <reference types="node" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Fills the CSP `connect-src` with exactly the API origin this build talks to (only 'self' in
 * demo mode), so the shipped policy never allows a broader set of hosts. The dev server alone
 * also allows inline styles, because Vite injects CSS as <style> tags for hot reload; the
 * built app loads one CSS file and ships the strict policy.
 */
export function cspPlugin(apiBase: string): Plugin {
  const url = apiBase === '' ? null : new URL(apiBase);
  if (url !== null && url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('VITE_API_BASE must be an http(s) URL');
  }
  const origin = url === null ? '' : url.origin;
  const connect = ["'self'", origin].filter((source) => source !== '').join(' ');
  return {
    name: 'jashn-csp',
    transformIndexHtml(html, context) {
      const styles = context.server === undefined ? "'self'" : "'self' 'unsafe-inline'";
      return html.replace('__CONNECT_SRC__', connect).replace('__STYLE_SRC__', styles);
    },
  };
}

/**
 * `VITE_BASE` lets the Pages workflow deploy under the repository sub-path (/jashn/); the
 * default '/' suits local runs and the server-hosted build.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [svelte(), cspPlugin(process.env.VITE_API_BASE ?? '')],
  build: { target: 'es2022' },
});
