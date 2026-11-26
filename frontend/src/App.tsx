// Route table (architecture.md section 6). Every page is React.lazy() so each route is its own chunk.
import { lazy, Suspense, type ComponentType } from 'react';
import { RouterProvider, createBrowserRouter, redirect, type RouteObject } from 'react-router';
import { CartProvider } from './cart';
import { StorefrontLayout } from './components/layout';
import { t } from './i18n';
import { apiGet } from './lib/api';
// Home is in the entry chunk: its hero is the LCP element, so it must not wait for a second chunk.
import HomePage from './pages/storefront/HomePage';
// Product detail is in the entry chunk too: its gallery image is the LCP element, and a lazy chunk
// would show the route fallback (a short shift) before the skeleton and delay the image request.
import ProductDetailPage from './pages/storefront/ProductDetailPage';

const ProductsPage = lazy(() => import('./pages/storefront/ProductsPage'));
const CategoryPage = lazy(() => import('./pages/storefront/CategoryPage'));
const ServicesPage = lazy(() => import('./pages/storefront/ServicesPage'));
const CartPage = lazy(() => import('./pages/storefront/CartPage'));
const AboutPage = lazy(() => import('./pages/storefront/AboutPage'));
const ContactPage = lazy(() => import('./pages/storefront/ContactPage'));
const ShippingReturnsPage = lazy(() => import('./pages/storefront/ShippingReturnsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/storefront/PrivacyPolicyPage'));
const NotFoundPage = lazy(() => import('./pages/storefront/NotFoundPage'));

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminShellPage = lazy(() => import('./pages/admin/AdminShellPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminProductEditorPage = lazy(() => import('./pages/admin/AdminProductEditorPage'));
const AdminServicesPage = lazy(() => import('./pages/admin/AdminServicesPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

function RouteFallback() {
  return (
    <p role="status" className="py-8 text-muted">
      {t('common.loading')}
    </p>
  );
}

function page(Page: ComponentType) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

/** Admin guard: any failure to read the session sends the browser to /admin/login. */
async function requireAdminSession({ request }: { request: Request }) {
  try {
    await apiGet('/api/admin/session', request.signal);
    return null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw redirect('/admin/login');
  }
}

export const routes: RouteObject[] = [
  {
    element: <StorefrontLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: page(ProductsPage) },
      { path: 'category/:slug', element: page(CategoryPage) },
      { path: 'product/:slug', element: <ProductDetailPage /> },
      { path: 'services', element: page(ServicesPage) },
      { path: 'cart', element: page(CartPage) },
      { path: 'about', element: page(AboutPage) },
      { path: 'contact', element: page(ContactPage) },
      { path: 'shipping-returns', element: page(ShippingReturnsPage) },
      { path: 'privacy-policy', element: page(PrivacyPolicyPage) },
      { path: '*', element: page(NotFoundPage) },
    ],
  },
  { path: 'admin/login', element: page(AdminLoginPage) },
  {
    path: 'admin',
    element: page(AdminShellPage),
    loader: requireAdminSession,
    children: [
      { index: true, element: page(AdminDashboardPage) },
      { path: 'products', element: page(AdminProductsPage) },
      { path: 'products/:id', element: page(AdminProductEditorPage) },
      { path: 'services', element: page(AdminServicesPage) },
      { path: 'orders', element: page(AdminOrdersPage) },
      { path: 'settings', element: page(AdminSettingsPage) },
    ],
  },
];

export const router = createBrowserRouter(routes);

export default function App() {
  return (
    <CartProvider>
      <RouterProvider router={router} />
    </CartProvider>
  );
}
