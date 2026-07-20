import { describe, expect, it, vi } from 'vitest';
import { BranchPermission, Role } from '@prisma/client';
import {
  requireBranchReportPermission,
  requireBranchUpdatePermission,
  requireBranchDeletePermission,
} from '../src/middleware/auth.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('branch report permission middleware', () => {
  it('blocks WRITE_ONLY branch owners from reports', () => {
    const req = {
      user: {
        role: Role.BRANCH_OWNER,
        branchPermission: BranchPermission.WRITE_ONLY,
      },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchReportPermission(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Your permission is restricted by admin. You cannot view reports.',
    });
  });

  it('allows WRITE_UPDATE branch owners to view reports', () => {
    const req = {
      user: {
        role: Role.BRANCH_OWNER,
        branchPermission: BranchPermission.WRITE_UPDATE,
      },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchReportPermission(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('allows WRITE_UPDATE_DELETE branch owners to view reports', () => {
    const req = {
      user: {
        role: Role.BRANCH_OWNER,
        branchPermission: BranchPermission.WRITE_UPDATE_DELETE,
      },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchReportPermission(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('bypasses report permission checks for ADMIN', () => {
    const req = {
      user: {
        role: Role.ADMIN,
        branchPermission: BranchPermission.WRITE_ONLY,
      },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchReportPermission(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe('existing branch permission middleware', () => {
  it('blocks WRITE_ONLY from update', () => {
    const req = {
      user: { role: Role.BRANCH_OWNER, branchPermission: BranchPermission.WRITE_ONLY },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchUpdatePermission(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('blocks WRITE_UPDATE from delete', () => {
    const req = {
      user: { role: Role.BRANCH_OWNER, branchPermission: BranchPermission.WRITE_UPDATE },
    } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();

    requireBranchDeletePermission(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
