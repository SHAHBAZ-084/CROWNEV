import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import path from 'path';
import { env } from './config/env.js';
import { requestTimeoutMiddleware } from './middleware/requestTimeout.js';
import {
  inputLengthMiddleware,
  stripPollutionMiddleware,
} from './middleware/security.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { productsRouter, branchProductsRouter } from './modules/products/products.routes.js';
import { partsRouter } from './modules/parts/parts.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { chassisRouter } from './modules/chassis/chassis.routes.js';
import { ordersRouter, walkInRouter } from './modules/orders/orders.routes.js';
import { servicesRouter, bookingsRouter } from './modules/services/services.routes.js';
import { serviceInvoicesRouter } from './modules/services/service-invoices.routes.js';
import { suppliersRouter, purchasesRouter } from './modules/suppliers/suppliers.routes.js';
import { accountingRouter } from './modules/accounting/accounting.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { testimonialsRouter } from './modules/testimonials/testimonials.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { contactRouter } from './modules/contact/contact.routes.js';
import { documentTypesRouter } from './modules/document-types/document-types.routes.js';
import { itemsRouter } from './modules/items/items.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind nginx — required for rate limiting and client IP via X-Forwarded-For
  app.set('trust proxy', 1);

  app.use(compression());
  app.use(helmet());
  app.use(hpp());
  app.use(requestTimeoutMiddleware);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(stripPollutionMiddleware);
  app.use(inputLengthMiddleware);
  app.use('/uploads', express.static(path.resolve(env.uploadDir)));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/branches', branchesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/branches', branchProductsRouter);
  app.use('/api/branches', chassisRouter);
  app.use('/api/parts', partsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/walk-in', walkInRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/service-invoices', serviceInvoicesRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/accounting', accountingRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/testimonials', testimonialsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/document-types', documentTypesRouter);
  app.use('/api/items', itemsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
