import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { cachePublicJson, noStorePublicJson } from '../../middleware/cacheControl.js';
import { productImageUpload } from '../../middleware/upload.js';
import { founderImagePublicUrl, saveFounderImageAsWebp } from '../../utils/imageProcessing.js';
import * as publicService from './public.service.js';

export const publicRouter = Router();

const founderProfileSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  vision: z.string().min(1),
  bio: z.string().min(1),
  image: z.string().min(1),
});

const foundersSectionSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  founders: z.array(founderProfileSchema).min(1).max(4),
});

const homeHeroSectionSchema = z.object({
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  subtext: z.string().min(1),
  primaryCtaLabel: z.string().min(1),
  secondaryCtaLabel: z.string().min(1),
});

const aboutHeroSectionSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  visionEyebrow: z.string().min(1),
  visionTitle: z.string().min(1),
  visionBody: z.string().min(1),
});

const featureIconSchema = z.enum(['zap', 'battery', 'gauge', 'shield']);

const featureCardSchema = z.object({
  icon: featureIconSchema,
  title: z.string().min(1),
  desc: z.string().min(1),
  stat: z.string().min(1),
  statLabel: z.string().min(1),
});

const featureSectionSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  features: z.array(featureCardSchema).min(1).max(6),
});

const footerContactSchema = z.object({
  email: z.string().email(),
  phones: z.array(z.string().min(1)).min(1).max(4),
  address: z.string().min(1),
});

const legalSectionSchema = z.object({
  title: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
});
const legalSectionsSchema = z.array(legalSectionSchema).min(1);

const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
const faqSectionSchema = z.array(faqItemSchema).min(1);

publicRouter.get(
  '/landing',
  cachePublicJson(120),
  asyncHandler(async (_req, res) => {
    const data = await publicService.getLandingData();
    res.json(data);
  })
);

publicRouter.get(
  '/parts-by-model',
  cachePublicJson(60),
  asyncHandler(async (req, res) => {
    const model = typeof req.query.model === 'string' ? req.query.model : '';
    const parts = await publicService.listPartsByModel(model);
    res.json(parts);
  })
);

publicRouter.get(
  '/pages',
  cachePublicJson(600),
  asyncHandler(async (_req, res) => {
    const pages = await publicService.listContentPages();
    res.json(pages);
  })
);

publicRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await publicService.getContentPage(param(req.params.slug));
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json(page);
  })
);

publicRouter.get(
  '/founders',
  noStorePublicJson,
  asyncHandler(async (_req, res) => {
    const section = await publicService.getFoundersSection();
    res.json(section);
  })
);

publicRouter.put(
  '/customization/founders',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(foundersSectionSchema),
  asyncHandler(async (req, res) => {
    const section = await publicService.upsertFoundersSection(req.body);
    res.json(section);
  })
);

publicRouter.get(
  '/features',
  noStorePublicJson,
  asyncHandler(async (_req, res) => {
    const section = await publicService.getFeatureSection();
    res.json(section);
  })
);

publicRouter.put(
  '/customization/features',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(featureSectionSchema),
  asyncHandler(async (req, res) => {
    const section = await publicService.upsertFeatureSection(req.body);
    res.json(section);
  })
);

publicRouter.get(
  '/footer-contact',
  noStorePublicJson,
  asyncHandler(async (_req, res) => {
    const section = await publicService.getFooterContact();
    res.json(section);
  })
);

publicRouter.put(
  '/customization/footer-contact',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(footerContactSchema),
  asyncHandler(async (req, res) => {
    const section = await publicService.upsertFooterContact(req.body);
    res.json(section);
  })
);

publicRouter.get(
  '/parts-fulfillment-branch',
  cachePublicJson(60),
  asyncHandler(async (_req, res) => {
    const setting = await publicService.getPartsFulfillmentBranch();
    res.json(setting);
  })
);

publicRouter.get(
  '/products/:id/available-colors',
  cachePublicJson(30),
  asyncHandler(async (req, res) => {
    const { branchId } = await publicService.getPartsFulfillmentBranch();
    if (!branchId) {
      res.json([]);
      return;
    }
    const colors = await publicService.getAvailableBikeColors(param(req.params.id), branchId);
    res.json(colors);
  }),
);

publicRouter.put(
  '/customization/parts-fulfillment-branch',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(z.object({ branchId: z.number().int().nullable() })),
  asyncHandler(async (req, res) => {
    const setting = await publicService.setPartsFulfillmentBranch(req.body.branchId);
    res.json(setting);
  })
);

publicRouter.get(
  '/home-hero',
  noStorePublicJson,
  asyncHandler(async (_req, res) => {
    const section = await publicService.getHomeHeroSection();
    res.json(section);
  })
);

publicRouter.put(
  '/customization/home-hero',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(homeHeroSectionSchema),
  asyncHandler(async (req, res) => {
    const section = await publicService.upsertHomeHeroSection(req.body);
    res.json(section);
  })
);

publicRouter.get(
  '/about-hero',
  noStorePublicJson,
  asyncHandler(async (_req, res) => {
    const section = await publicService.getAboutHeroSection();
    res.json(section);
  })
);

publicRouter.put(
  '/customization/about-hero',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(aboutHeroSectionSchema),
  asyncHandler(async (req, res) => {
    const section = await publicService.upsertAboutHeroSection(req.body);
    res.json(section);
  })
);

publicRouter.post(
  '/upload-founder-image',
  authenticate,
  requireRoles(Role.ADMIN),
  productImageUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image uploaded' });
      return;
    }
    const filename = await saveFounderImageAsWebp(req.file.buffer);
    res.json({ url: founderImagePublicUrl(filename) });
  })
);

publicRouter.put(
  '/pages/:slug',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(z.object({ title: z.string().min(1), content: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const page = await publicService.upsertContentPage(
      param(req.params.slug),
      req.body.title,
      req.body.content
    );
    res.json(page);
  })
);

publicRouter.get('/terms', cachePublicJson(60), asyncHandler(async (_req, res) => {
  const sections = await publicService.getTermsSection();
  res.json(sections);
}));

publicRouter.put(
  '/customization/terms',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(legalSectionsSchema),
  asyncHandler(async (req, res) => {
    const sections = await publicService.upsertTermsSection(req.body);
    res.json(sections);
  }),
);

publicRouter.get('/privacy', cachePublicJson(60), asyncHandler(async (_req, res) => {
  const sections = await publicService.getPrivacySection();
  res.json(sections);
}));

publicRouter.put(
  '/customization/privacy',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(legalSectionsSchema),
  asyncHandler(async (req, res) => {
    const sections = await publicService.upsertPrivacySection(req.body);
    res.json(sections);
  }),
);

publicRouter.get('/faq', cachePublicJson(60), asyncHandler(async (_req, res) => {
  const items = await publicService.getFaqSection();
  res.json(items);
}));

publicRouter.put(
  '/customization/faq',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(faqSectionSchema),
  asyncHandler(async (req, res) => {
    const items = await publicService.upsertFaqSection(req.body);
    res.json(items);
  }),
);
