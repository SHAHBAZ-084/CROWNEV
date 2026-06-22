import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../../utils/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, try again later' },
});

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateBody(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().optional(),
      city: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  })
);

authRouter.post(
  '/verify-otp',
  authLimiter,
  validateBody(z.object({ email: z.string().email(), otp: z.string().length(6) })),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyRegistration(req.body.email, req.body.otp);
    res.json(result);
  })
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(z.object({ email: z.string().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    res.json(result);
  })
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validateBody(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  })
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validateBody(
    z.object({
      email: z.string().email(),
      otp: z.string().length(6),
      newPassword: z.string().min(8),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(
      req.body.email,
      req.body.otp,
      req.body.newPassword
    );
    res.json(result);
  })
);

authRouter.post(
  '/google',
  authLimiter,
  validateBody(
    z.object({
      googleId: z.string(),
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.googleAuth(
      req.body.googleId,
      req.body.email,
      req.body.firstName,
      req.body.lastName
    );
    res.json(result);
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.userId);
    res.json(user);
  })
);

authRouter.patch(
  '/me',
  authenticate,
  validateBody(
    z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    res.json(user);
  })
);

authRouter.post(
  '/change-password',
  authenticate,
  authLimiter,
  validateBody(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(
      req.user!.userId,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json(result);
  })
);
