import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, AppError, param, validateBody } from '../../utils/helpers.js';
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
      role: z.nativeEnum(Role),
      phone: z.string().optional(),
      city: z.string().optional(),
      branchId: z.number().int().optional(),
    })
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
      role: z.nativeEnum(Role).optional(),
      branchId: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const targetId = param(req.params.id);
    if (targetId === req.user!.userId && req.body.role && req.body.role !== req.user!.role) {
      throw new AppError(400, 'Admins cannot change their own role');
    }
    const user = await usersService.updateUser(targetId, req.body);
    res.json(user);
  })
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await usersService.deleteUser(param(req.params.id));
    res.status(204).send();
  })
);
