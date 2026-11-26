import { t, type MessageKey } from '../../i18n';
import type { PageMeta } from './useDocumentMeta';

/** Appends the site name: "Shop | Beauty Store". */
export function documentTitle(pageTitle: string): string {
  return `${pageTitle} | ${t('seo.siteName')}`;
}

function metaFor(titleKey: MessageKey, descriptionKey: MessageKey): PageMeta {
  return { title: documentTitle(t(titleKey)), description: t(descriptionKey) };
}

/** Meta for a storefront path. Unknown paths get the not-found meta, matching the * route. */
export function storefrontMeta(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return metaFor('seo.home.title', 'seo.home.description');
  if (path === '/products') return metaFor('seo.products.title', 'seo.products.description');
  if (path.startsWith('/category/')) {
    return metaFor('seo.category.title', 'seo.category.description');
  }
  if (path.startsWith('/product/')) {
    return metaFor('seo.productDetail.title', 'seo.productDetail.description');
  }
  if (path === '/services') return metaFor('seo.services.title', 'seo.services.description');
  if (path === '/cart') return metaFor('seo.cart.title', 'seo.cart.description');
  if (path === '/about') return metaFor('seo.about.title', 'seo.about.description');
  if (path === '/contact') return metaFor('seo.contact.title', 'seo.contact.description');
  if (path === '/shipping-returns') {
    return metaFor('seo.shippingReturns.title', 'seo.shippingReturns.description');
  }
  if (path === '/privacy-policy') {
    return metaFor('seo.privacyPolicy.title', 'seo.privacyPolicy.description');
  }
  return metaFor('seo.notFound.title', 'seo.notFound.description');
}
