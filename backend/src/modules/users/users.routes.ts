import { Router } from 'express';
import { BranchPermission, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { passwordSchema } from '../../utils/passwordSchema.js';
import * as usersService from './users.service.js';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRoles(Role.ADMIN));

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await usersService.listUsers({
      page: req.query.page as string,
      limit: req.query.limit as string,
      role: req.query.role as Role | undefined,
      search: req.query.search as string,
    });
    res.json(result);
  })
);

usersRouter.post(
  '/',
  validateBody(
    z.object({
      email: z.string().email(),
      password: passwordSchema,
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      role: z.literal(Role.BRANCH_OWNER),
      phone: z.string().optional(),
      city: z.string().optional(),
      branchId: z.number().int(),
      branchPermission: z.nativeEnum(BranchPermission).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  })
);

usersRouter.patch(
  '/:id',
  validateBody(
    z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      branchId: z.number().int().optional(),
      isActive: z.boolean().optional(),
      branchPermission: z.nativeEnum(BranchPermission).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateUser(param(req.params.id), req.body);
    res.json(user);
  })
);

usersRouter.patch(
  '/:id/password',
  validateBody(
    z.object({
      newPassword: passwordSchema,
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await usersService.setUserPassword(param(req.params.id), req.body.newPassword);
    res.json(result);
  })
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await usersService.deleteUser(param(req.params.id));
    res.status(204).send();
  })
);
