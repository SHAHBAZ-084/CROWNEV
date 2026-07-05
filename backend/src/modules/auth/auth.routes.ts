import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../../utils/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { passwordSchema } from '../../utils/passwordSchema.js';
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
      email: z.string().email('Please enter a valid email address'),
      password: passwordSchema,
      firstName: z.string().min(1, 'Please enter your first name'),
      lastName: z.string().min(1, 'Please enter your last name'),
      phone: z.string().min(1, 'Please enter your phone number'),
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
  validateBody(
    z.object({
      email: z.string().email('Please enter a valid email address'),
      otp: z.string().length(6, 'Enter the 6-digit code we sent you'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyRegistration(req.body.email, req.body.otp);
    res.json(result);
  })
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(
    z.object({
      email: z.string().email('Please enter a valid email address'),
      password: z.string().min(1, 'Please enter your password'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    res.json(result);
  })
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validateBody(z.object({ email: z.string().email('Please enter a valid email address') })),
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
      email: z.string().email('Please enter a valid email address'),
      otp: z.string().length(6, 'Enter the 6-digit code we sent you'),
      newPassword: passwordSchema,
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
  validateBody(z.object({ idToken: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await authService.googleAuth(req.body.idToken);
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
      firstName: z.string().min(1, 'Please enter your first name').optional(),
      lastName: z.string().min(1, 'Please enter your last name').optional(),
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
      currentPassword: z.string().min(1, 'Please enter your current password'),
      newPassword: passwordSchema,
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

authRouter.post(
  '/delete-account',
  authenticate,
  authLimiter,
  validateBody(
    z.object({
      currentPassword: z.string().optional(),
      confirmEmail: z.string().email('Please enter a valid email address').optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.deleteMyAccount(req.user!.userId, req.body);
    res.json(result);
  }),
);
