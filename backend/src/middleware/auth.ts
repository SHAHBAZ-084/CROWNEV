import { NextFunction, Request, Response } from 'express';
import { BranchPermission, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { verifyToken } from '../utils/crypto.js';
import { AppError } from '../utils/helpers.js';

const RESTRICTED_MSG = 'Your permission is restricted by admin';

async function loadAuthUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, branchId: true, branchPermission: true },
  });
}

function attachUser(
  req: Request,
  payload: import('../types/jwt.js').JwtPayload,
  user: NonNullable<Awaited<ReturnType<typeof loadAuthUser>>>,
) {
  req.user = {
    ...payload,
    role: user.role,
    branchId: user.branchId,
    branchPermission: user.branchPermission,
  };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = await loadAuthUser(payload.userId);
    if (!user?.isActive) {
      next(new AppError(401, 'Account deactivated'));
      return;
    }
    attachUser(req, payload, user);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      const user = await loadAuthUser(payload.userId);
      if (user?.isActive) {
        attachUser(req, payload, user);
      }
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

export function requireBranchWritePermission(req: Request, _res: Response, next: NextFunction) {
  next();
}

export function requireBranchUpdatePermission(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.BRANCH_OWNER) {
    next();
    return;
  }
  const perm = req.user.branchPermission ?? BranchPermission.WRITE_UPDATE_DELETE;
  if (perm === BranchPermission.WRITE_ONLY) {
    res.status(403).json({ error: `${RESTRICTED_MSG}. You cannot update records.` });
    return;
  }
  next();
}

export function requireBranchDeletePermission(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.BRANCH_OWNER) {
    next();
    return;
  }
  const perm = req.user.branchPermission ?? BranchPermission.WRITE_UPDATE_DELETE;
  if (perm === BranchPermission.WRITE_ONLY || perm === BranchPermission.WRITE_UPDATE) {
    res.status(403).json({ error: `${RESTRICTED_MSG}. You cannot delete records.` });
    return;
  }
  next();
}

export function requireBranchReportPermission(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.BRANCH_OWNER) {
    next();
    return;
  }
  const perm = req.user.branchPermission ?? BranchPermission.WRITE_UPDATE_DELETE;
  if (perm === BranchPermission.WRITE_ONLY) {
    res.status(403).json({ error: `${RESTRICTED_MSG}. You cannot view reports.` });
    return;
  }
  next();
}
