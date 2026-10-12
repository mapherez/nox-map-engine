import type { Plugin } from 'vite';

/** Resolve locale tokens in dev and production HTML before it reaches the browser. */
export function localeHtml(locale: Record<string, unknown>): Plugin {
  return {
    name: 'locale-html',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace(/%locale\.([\w]+)%/g, (_, key: string) => {
        const value = Object.hasOwn(locale, key) ? locale[key] : undefined;
        if (typeof value !== 'string') throw new Error(`Unknown HTML locale key: ${key}`);
        return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
      }),
    },
  };
}
