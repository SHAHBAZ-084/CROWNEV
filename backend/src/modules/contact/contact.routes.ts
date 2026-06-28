import { Router } from 'express';
import { ContactStatus, Role } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as contactService from './contact.service.js';

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many contact submissions' },
});

export const contactRouter = Router();

contactRouter.post(
  '/',
  contactLimiter,
  validateBody(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      message: z.string().min(10),
      branchId: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const message = await contactService.submitContact(req.body);
    res.status(201).json({ message: 'Thank you. We will get back to you soon.', id: message.id });
  })
);

contactRouter.use(authenticate, requireRoles(Role.ADMIN));

contactRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await contactService.listContacts({
      page: req.query.page as string,
      limit: req.query.limit as string,
      status: req.query.status as ContactStatus | undefined,
    });
    res.json(result);
  })
);

contactRouter.patch(
  '/:id/status',
  validateBody(z.object({ status: z.nativeEnum(ContactStatus) })),
  asyncHandler(async (req, res) => {
    const message = await contactService.updateContactStatus(
      parseInt(param(req.params.id), 10),
      req.body.status
    );
    res.json(message);
  })
);
