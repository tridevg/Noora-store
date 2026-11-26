import { useEffect } from 'react';

export interface PageMeta {
  /** Full document title, including the site name. */
  title: string;
  description: string;
  type?: 'website' | 'article';
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

/** Writes the title, description and Open Graph tags for the current route. Dependency-free. */
export function applyDocumentMeta(meta: PageMeta, pathname: string): void {
  const url = new URL(pathname, window.location.origin).href;
  document.title = meta.title;
  setMeta('name', 'description', meta.description);
  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', meta.description);
  setMeta('property', 'og:type', meta.type ?? 'website');
  setMeta('property', 'og:url', url);
}

/** Keeps the document head in step with the route. Re-runs when the path or meta text changes. */
export function useDocumentMeta(meta: PageMeta, pathname: string): void {
  const { title, description, type } = meta;
  useEffect(() => {
    applyDocumentMeta({ title, description, type }, pathname);
  }, [title, description, type, pathname]);
}
