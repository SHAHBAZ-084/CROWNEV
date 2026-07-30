import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../../utils/helpers.js';
import { csvResponse, toCsv } from '../../utils/export.js';
import { authenticate, requireBranchReportPermission, requireRoles } from '../../middleware/auth.js';
import * as reportsService from './reports.service.js';
import * as accountingService from '../accounting/accounting.service.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

function resolveBranchId(req: import('express').Request): number | undefined {
  return req.user!.role === Role.BRANCH_OWNER
    ? req.user!.branchId ?? undefined
    : req.query.branchId
      ? parseInt(req.query.branchId as string, 10)
      : undefined;
}

reportsRouter.get(
  '/admin/dashboard',
  requireRoles(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const dashboard = await reportsService.getAdminDashboard();
    res.json(dashboard);
  })
);

reportsRouter.get(
  '/revenue',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const trend = await reportsService.getRevenueTrend(branchId, days);
    res.json(trend);
  })
);

reportsRouter.get(
  '/branch/summary',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    if (req.user!.role === Role.BRANCH_OWNER && branchId === undefined) {
      res.status(400).json({ error: 'Branch required' });
      return;
    }
    const period = (req.query.period as reportsService.ReportPeriod) || 'monthly';
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      res.status(400).json({ error: 'Invalid period' });
      return;
    }
    const summary = await reportsService.getSalesSummary(period, branchId);
    res.json(summary);
  }),
);

reportsRouter.get(
  '/export/orders',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const rows = await reportsService.exportOrders(
      branchId,
      req.query.from as string,
      req.query.to as string,
      { page: req.query.page as string, limit: req.query.limit as string }
    );
    if (req.query.format === 'csv') {
      csvResponse(res, 'orders.csv', toCsv(rows));
      return;
    }
    res.json(rows);
  })
);

reportsRouter.get(
  '/export/bookings',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const rows = await reportsService.exportBookings(
      branchId,
      req.query.from as string,
      req.query.to as string,
      { page: req.query.page as string, limit: req.query.limit as string }
    );
    if (req.query.format === 'csv') {
      csvResponse(res, 'bookings.csv', toCsv(rows));
      return;
    }
    res.json(rows);
  })
);

reportsRouter.get(
  '/export/inventory',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const rows = await reportsService.exportInventory(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
    });
    if (req.query.format === 'csv') {
      csvResponse(res, 'inventory.csv', toCsv(rows));
      return;
    }
    res.json(rows);
  })
);

reportsRouter.get(
  '/export/trial-balance/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.branchId as string, 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const trialBalance = await accountingService.getTrialBalance(branchId);
    if (req.query.format === 'csv') {
      csvResponse(res, `trial-balance-${branchId}.csv`, toCsv(trialBalance.accounts));
      return;
    }
    res.json(trialBalance);
  })
);

reportsRouter.get(
  '/profit-loss/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.branchId as string, 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const revenueType = req.query.type as 'sale' | 'service';
    if (!['sale', 'service'].includes(revenueType)) {
      res.status(400).json({ error: 'type must be sale or service' });
      return;
    }
    const report = await reportsService.getProfitLossReport(branchId, revenueType, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(report);
  }),
);

reportsRouter.patch(
  '/profit-loss/settle',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchReportPermission,
  validateBody(
    z.object({
      chassisNumbers: z.array(z.string().min(1)).min(1),
      settled: z.boolean(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    if (branchId === undefined || !Number.isFinite(branchId)) {
      res.status(400).json({ error: 'Branch required' });
      return;
    }
    const updated = await reportsService.setChassisProfitSettled(
      branchId,
      req.body.chassisNumbers,
      req.body.settled,
      req.user!.userId,
    );
    res.json({ updated });
  }),
);
