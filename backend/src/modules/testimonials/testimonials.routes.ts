import { Router } from 'express';
import { Role, TestimonialStatus } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as testimonialsService from './testimonials.service.js';

export const testimonialsRouter = Router();

testimonialsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const testimonials = await testimonialsService.listTestimonials();
    res.json(testimonials);
  })
);

testimonialsRouter.post(
  '/submit',
  validateBody(
    z.object({
      customerName: z.string().min(1),
      content: z.string().min(10),
      rating: z.number().int().min(1).max(5).optional(),
      imageUrl: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const testimonial = await testimonialsService.submitTestimonial(req.body);
    res.status(201).json({ message: 'Submitted for review', id: testimonial.id });
  })
);

testimonialsRouter.use(authenticate, requireRoles(Role.ADMIN));

testimonialsRouter.get(
  '/pending',
  asyncHandler(async (_req, res) => {
    const testimonials = await testimonialsService.listPendingTestimonials();
    res.json(testimonials);
  })
);

testimonialsRouter.get(
  '/all',
  asyncHandler(async (_req, res) => {
    const testimonials = await testimonialsService.listAllTestimonialsForAdmin();
    res.json(testimonials);
  })
);

testimonialsRouter.post(
  '/',
  validateBody(
    z.object({
      customerName: z.string().min(1),
      content: z.string().min(1),
      rating: z.number().int().min(1).max(5).optional(),
      imageUrl: z.string().optional(),
      sortOrder: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const testimonial = await testimonialsService.createTestimonial(req.body);
    res.status(201).json(testimonial);
  })
);

testimonialsRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const testimonial = await testimonialsService.approveTestimonial(parseInt(param(req.params.id), 10));
    res.json(testimonial);
  })
);

testimonialsRouter.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const testimonial = await testimonialsService.rejectTestimonial(parseInt(param(req.params.id), 10));
    res.json(testimonial);
  })
);

testimonialsRouter.patch(
  '/:id',
  validateBody(
    z.object({
      customerName: z.string().min(1).max(200).optional(),
      content: z.string().min(1).max(5000).optional(),
      rating: z.number().int().min(1).max(5).optional(),
      imageUrl: z.string().max(2048).optional(),
      sortOrder: z.number().int().optional(),
      status: z.nativeEnum(TestimonialStatus).optional(),
      isActive: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const testimonial = await testimonialsService.updateTestimonial(parseInt(param(req.params.id), 10), req.body);
    res.json(testimonial);
  })
);

testimonialsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await testimonialsService.deleteTestimonial(parseInt(param(req.params.id), 10));
    res.status(204).send();
  })
);
