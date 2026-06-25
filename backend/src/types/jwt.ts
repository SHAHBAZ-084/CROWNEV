import { Role, BranchPermission } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  branchId?: number | null;
  branchPermission?: BranchPermission;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      branchScope?: number;
    }
  }
}

export {};
