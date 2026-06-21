import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  branchId?: number | null;
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
