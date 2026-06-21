import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { productsRouter, branchProductsRouter } from './modules/products/products.routes.js';
import { partsRouter } from './modules/parts/parts.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { ordersRouter, walkInRouter } from './modules/orders/orders.routes.js';
import { servicesRouter, bookingsRouter } from './modules/services/services.routes.js';
import { suppliersRouter, purchasesRouter } from './modules/suppliers/suppliers.routes.js';
import { accountingRouter } from './modules/accounting/accounting.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { testimonialsRouter } from './modules/testimonials/testimonials.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { contactRouter } from './modules/contact/contact.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.resolve(env.uploadDir)));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/branches', branchesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/branches', branchProductsRouter);
  app.use('/api/parts', partsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/walk-in', walkInRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/accounting', accountingRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/testimonials', testimonialsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/contact', contactRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
