import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../utils/crypto.js';
import { AppError } from '../utils/helpers.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}

export function branchScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  if (req.user.role === Role.ADMIN) {
    const requestedBranchId = parseInt(String(req.params.branchId ?? req.query.branchId ?? req.body?.branchId ?? ''), 10);
    req.branchScope = Number.isNaN(requestedBranchId) ? undefined : requestedBranchId;
  } else if (req.user.role === Role.BRANCH_OWNER) {
    if (!req.user.branchId) {
      next(new AppError(403, 'Branch not assigned'));
      return;
    }
    req.branchScope = req.user.branchId;

    const tamperedBranchId =
      req.params.branchId ?? req.query.branchId ?? req.body?.branchId;
    if (
      tamperedBranchId !== undefined &&
      parseInt(String(tamperedBranchId), 10) !== req.user.branchId
    ) {
      next(new AppError(403, 'Cross-branch access denied'));
      return;
    }
  }

  next();
}

export function enforceBranchAccess(branchId: number | undefined, userBranchId?: number | null, role?: Role) {
  if (role === Role.ADMIN) return;
  if (role === Role.BRANCH_OWNER && branchId !== userBranchId) {
    throw new AppError(403, 'Cross-branch access denied');
  }
}
