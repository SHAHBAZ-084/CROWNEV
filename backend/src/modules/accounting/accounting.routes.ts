import { Router } from 'express';
import { AccountType, BranchPermission, Role, VoucherType } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody, AppError } from '../../utils/helpers.js';
import { authenticate, requireBranchDeletePermission, requireBranchReportPermission, requireBranchUpdatePermission, requireRoles } from '../../middleware/auth.js';
import * as accountingService from './accounting.service.js';

export const accountingRouter = Router();

accountingRouter.use(authenticate, requireRoles(Role.ADMIN, Role.BRANCH_OWNER));

function assertBranch(req: import('express').Request, branchId: number) {
  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw Object.assign(new Error('Invalid branch ID'), { statusCode: 400 });
  }
  if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
    throw Object.assign(new Error('Cross-branch access denied'), { statusCode: 403 });
  }
}

function assertFinancialYearManagePermission(req: import('express').Request) {
  if (req.user!.role === Role.ADMIN) return;
  if (req.user!.branchPermission !== BranchPermission.WRITE_UPDATE_DELETE) {
    throw new AppError(403, 'Only a full-access account can manage financial years.');
  }
}

accountingRouter.get(
  '/:branchId/suppliers',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const { listBranchSuppliers } = await import('../suppliers/suppliers.service.js');
    const result = await listBranchSuppliers(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
      search: req.query.search as string,
    });
    res.json(result);
  }),
);

accountingRouter.get(
  '/:branchId/customers',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const { listBranchCustomers } = await import('../orders/orders.service.js');
    const result = await listBranchCustomers(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
      search: req.query.search as string,
    });
    res.json(result);
  }),
);

accountingRouter.get(
  '/:branchId/categories',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const categories = await accountingService.listAccountCategories(branchId);
    res.json(categories);
  })
);

accountingRouter.post(
  '/:branchId/categories',
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const category = await accountingService.createAccountCategory(branchId, req.body.name);
    res.status(201).json(category);
  })
);

accountingRouter.delete(
  '/:branchId/categories/:id',
  requireBranchDeletePermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const category = await accountingService.softDeleteAccountCategory(
      parseInt(param(req.params.id), 10),
      branchId,
    );
    res.json(category);
  })
);

accountingRouter.get(
  '/:branchId/accounts',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const usePagination =
      req.query.page != null
      || req.query.limit != null
      || req.query.search != null
      || req.query.categoryId != null;
    if (usePagination) {
      const result = await accountingService.listAccountsPaginated(branchId, {
        page: req.query.page as string,
        limit: req.query.limit as string,
        search: req.query.search as string,
        categoryId: req.query.categoryId as string,
      });
      res.json(result);
      return;
    }
    const accounts = await accountingService.listAccounts(branchId);
    res.json(accounts);
  })
);

accountingRouter.get(
  '/:branchId/accounts/:accountId',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const account = await accountingService.getAccount(
      branchId,
      parseInt(param(req.params.accountId), 10),
    );
    res.json(account);
  }),
);

accountingRouter.get(
  '/:branchId/suppliers/:supplierId',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const { getBranchSupplier } = await import('../suppliers/suppliers.service.js');
    const supplier = await getBranchSupplier(parseInt(param(req.params.supplierId), 10), branchId);
    res.json(supplier);
  }),
);

accountingRouter.post(
  '/:branchId/accounts',
  validateBody(
    z.object({
      categoryId: z.number().int(),
      name: z.string().min(1),
      code: z.string().min(1).optional(),
      type: z.nativeEnum(AccountType).optional(),
      openingBalance: z.number().min(0).optional(),
      openingBalanceSide: z.enum(['DR', 'CR']).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const account = await accountingService.createAccount({ branchId, ...req.body });
    res.status(201).json(account);
  })
);

accountingRouter.get(
  '/:branchId/vouchers',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const vouchers = await accountingService.listVouchers(branchId);
    res.json(vouchers);
  })
);

accountingRouter.post(
  '/:branchId/vouchers',
  validateBody(
    z.object({
      type: z.nativeEnum(VoucherType),
      debitAccountId: z.number().int(),
      creditAccountId: z.number().int(),
      amount: z.number().positive(),
      description: z.string().optional(),
      reference: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const voucher = await accountingService.createVoucher({
      branchId,
      ...req.body,
      createdById: req.user!.userId,
    });
    res.status(201).json(voucher);
  })
);

accountingRouter.patch(
  '/:branchId/vouchers/:voucherId',
  requireBranchUpdatePermission,
  validateBody(z.object({ amount: z.number().positive() })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const voucher = await accountingService.updateVoucherAmount(
      branchId,
      parseInt(param(req.params.voucherId), 10),
      req.body.amount,
      req.user!.userId,
    );
    res.json(voucher);
  }),
);

accountingRouter.delete(
  '/:branchId/vouchers/:voucherId',
  requireBranchDeletePermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const voucher = await accountingService.cancelVoucher(
      branchId,
      parseInt(param(req.params.voucherId), 10),
      req.user!.userId,
    );
    res.json(voucher);
  })
);

accountingRouter.get(
  '/:branchId/trial-balance',
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const trialBalance = await accountingService.getTrialBalance(branchId);
    res.json(trialBalance);
  })
);

accountingRouter.get(
  '/:branchId/banks',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const banks = await accountingService.listBankAccounts(branchId);
    res.json(banks);
  })
);

accountingRouter.post(
  '/:branchId/banks',
  validateBody(
    z.object({
      name: z.string().min(1),
      accountNumber: z.string().optional(),
      openingBalance: z.number().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const bank = await accountingService.createBankAccount({ branchId, ...req.body });
    res.status(201).json(bank);
  })
);

accountingRouter.get(
  '/:branchId/ledger/:accountId',
  requireBranchReportPermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const accountId = parseInt(param(req.params.accountId), 10);
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const financialYearIdParam = req.query.financialYearId as string | undefined;

    if (financialYearIdParam) {
      assertFinancialYearManagePermission(req);
    }

    const ledger = financialYearIdParam
      ? await accountingService.getLedgerEntriesForYear(
          accountId,
          branchId,
          parseInt(financialYearIdParam, 10),
          fromDate,
          toDate,
        )
      : await accountingService.getLedgerEntries(accountId, branchId, fromDate, toDate);
    res.json(ledger);
  })
);

accountingRouter.get(
  '/:branchId/financial-years',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    assertFinancialYearManagePermission(req);
    const years = await accountingService.listFinancialYears(branchId);
    res.json(years);
  })
);

accountingRouter.post(
  '/:branchId/financial-year/close',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    assertFinancialYearManagePermission(req);
    const result = await accountingService.closeFinancialYear(branchId, req.user!.userId);
    res.status(201).json(result);
  })
);

accountingRouter.post(
  '/:branchId/trial-balance/approve',
  validateBody(z.object({ period: z.string().min(1), notes: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const approval = await accountingService.approveTrialBalance({
      branchId,
      period: req.body.period,
      notes: req.body.notes,
      approvedById: req.user!.userId,
    });
    res.status(201).json(approval);
  })
);

accountingRouter.get(
  '/:branchId/trial-balance/approvals',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const approvals = await accountingService.listTrialBalanceApprovals(branchId);
    res.json(approvals);
  })
);

accountingRouter.patch(
  '/:branchId/banks/:id',
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      name: z.string().optional(),
      accountNumber: z.string().optional(),
      runningBalance: z.number().optional(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const bank = await accountingService.updateBankAccount(
      parseInt(param(req.params.id), 10),
      branchId,
      req.body
    );
    res.json(bank);
  })
);

accountingRouter.patch(
  '/:branchId/accounts/:id',
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      name: z.string().optional(),
      code: z.string().optional(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const account = await accountingService.updateAccount(
      parseInt(param(req.params.id), 10),
      branchId,
      req.body
    );
    res.json(account);
  })
);

accountingRouter.delete(
  '/:branchId/accounts/:id',
  requireBranchDeletePermission,
  validateBody(
    z.object({
      password: z.string().min(1, 'Password is required to delete an account'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranch(req, branchId);
    const result = await accountingService.hardDeleteAccount(
      parseInt(param(req.params.id), 10),
      branchId,
      req.user!.userId,
      req.body.password,
    );
    res.json(result);
  })
);
