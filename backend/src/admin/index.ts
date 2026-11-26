import { Hono } from 'hono';
import { loginRoutes, sessionRoutes } from './auth.routes';
import { csrfForMutations, noStore, requireSession, type AdminEnv } from './middleware';
import { dashboardRoutes } from './dashboard.routes';
import { productsRoutes } from './products.routes';
import { variantsRoutes } from './variants.routes';
import { uploadsRoutes } from './uploads.routes';
import { servicesRoutes } from './services.routes';
import { ordersRoutes } from './orders.routes';
import { settingsRoutes } from './settings.routes';

/**
 * Mounted by backend/src/index.ts at /api/admin. Paths below are relative to that prefix.
 * Order matters: login is registered first and returns before the session gate runs.
 */
export const adminRoutes = new Hono<AdminEnv>();

adminRoutes.use('*', noStore);
adminRoutes.route('/', loginRoutes);
adminRoutes.use('*', requireSession);
adminRoutes.use('*', csrfForMutations);
adminRoutes.route('/', sessionRoutes);
adminRoutes.route('/', dashboardRoutes);
adminRoutes.route('/', productsRoutes);
adminRoutes.route('/', variantsRoutes);
adminRoutes.route('/', uploadsRoutes);
adminRoutes.route('/', servicesRoutes);
adminRoutes.route('/', ordersRoutes);
adminRoutes.route('/', settingsRoutes);
