import { Router } from 'express';
import { ProductType, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, optionalAuth, requireRoles } from '../../middleware/auth.js';
import { productImageUpload } from '../../middleware/upload.js';
import * as productsService from './products.service.js';

export const productsRouter = Router();

const priceField = z.number().positive().max(9_999_999_999.99, 'Price exceeds maximum allowed value');

const productCreateSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(ProductType),
  brandId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  price: priceField,
  salePrice: priceField.optional(),
  description: z.string().optional(),
  specs: z.record(z.unknown()).optional(),
  colorOptions: z.record(z.unknown()).optional(),
});

const productUpdateSchema = productCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

productsRouter.get(
  '/shop',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const result = await productsService.listProducts({
      page: req.query.page as string,
      limit: req.query.limit as string,
      type: req.query.type as ProductType | undefined,
      brandId: req.query.brandId ? parseInt(req.query.brandId as string, 10) : undefined,
      categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined,
      search: req.query.search as string,
      activeOnly: true,
      branchId: req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined,
    });
    res.json(result);
  })
);

productsRouter.get(
  '/shop/:id',
  asyncHandler(async (req, res) => {
    const product = await productsService.getProduct(param(req.params.id));
    res.json(product);
  })
);

productsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await productsService.listCategories();
    res.json(categories);
  })
);

productsRouter.get(
  '/brands',
  asyncHandler(async (_req, res) => {
    const brands = await productsService.listBrands();
    res.json(brands);
  })
);

productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const result = await productsService.listProducts({
      page: req.query.page as string,
      limit: req.query.limit as string,
      type: req.query.type as ProductType | undefined,
      search: req.query.search as string,
      branchId,
    });
    res.json(result);
  })
);

productsRouter.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const product = await productsService.getProduct(param(req.params.id));
    res.json(product);
  })
);

productsRouter.post(
  '/upload-images',
  requireRoles(Role.ADMIN),
  productImageUpload.array('images', 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      res.status(400).json({ error: 'No images uploaded' });
      return;
    }
    const urls = files.map((f) => `/uploads/products/${f.filename}`);
    res.json({ urls });
  })
);

productsRouter.post(
  '/',
  requireRoles(Role.ADMIN),
  validateBody(productCreateSchema),
  asyncHandler(async (req, res) => {
    const product = await productsService.createProduct(req.body);
    res.status(201).json(product);
  })
);

productsRouter.patch(
  '/:id',
  requireRoles(Role.ADMIN),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const product = await productsService.updateProduct(param(req.params.id), req.body);
    res.json(product);
  })
);

productsRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await productsService.deleteProduct(param(req.params.id));
    res.status(204).send();
  })
);

productsRouter.post(
  '/:id/images',
  requireRoles(Role.ADMIN),
  validateBody(
    z.object({
      url: z.string().min(1),
      isPrimary: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const image = await productsService.addProductImage(
      param(req.params.id),
      req.body.url,
      req.body.isPrimary,
      req.body.sortOrder
    );
    res.status(201).json(image);
  })
);

productsRouter.patch(
  '/:id/images/:imageId/primary',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const image = await productsService.setProductImagePrimary(
      param(req.params.id),
      parseInt(param(req.params.imageId), 10)
    );
    res.json(image);
  })
);

productsRouter.delete(
  '/:id/images/:imageId',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await productsService.deleteProductImage(
      param(req.params.id),
      parseInt(param(req.params.imageId), 10)
    );
    res.status(204).send();
  })
);

productsRouter.post(
  '/categories',
  requireRoles(Role.ADMIN),
  validateBody(z.object({ name: z.string(), parentId: z.number().int().optional(), imageUrl: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const category = await productsService.createCategory(req.body);
    res.status(201).json(category);
  })
);

productsRouter.post(
  '/brands',
  requireRoles(Role.ADMIN),
  validateBody(z.object({ name: z.string(), logoUrl: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const brand = await productsService.createBrand(req.body);
    res.status(201).json(brand);
  })
);

productsRouter.patch(
  '/categories/:id',
  requireRoles(Role.ADMIN),
  validateBody(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    const category = await productsService.updateCategory(parseInt(param(req.params.id), 10), req.body);
    res.json(category);
  })
);

productsRouter.delete(
  '/categories/:id',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await productsService.deleteCategory(parseInt(param(req.params.id), 10));
    res.status(204).send();
  })
);

productsRouter.patch(
  '/brands/:id',
  requireRoles(Role.ADMIN),
  validateBody(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    const brand = await productsService.updateBrand(parseInt(param(req.params.id), 10), req.body);
    res.json(brand);
  })
);

productsRouter.delete(
  '/brands/:id',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await productsService.deleteBrand(parseInt(param(req.params.id), 10));
    res.status(204).send();
  })
);

export const branchProductsRouter = Router();
branchProductsRouter.use(authenticate, requireRoles(Role.ADMIN, Role.BRANCH_OWNER), branchScope);

branchProductsRouter.get(
  '/:branchId/products',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const products = await productsService.listBranchProducts(branchId);
    res.json(products);
  })
);

branchProductsRouter.put(
  '/:branchId/products/:productId',
  validateBody(z.object({ isListed: z.boolean() })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await productsService.setBranchProduct(
      branchId,
      param(req.params.productId),
      req.body.isListed
    );
    res.json(result);
  })
);
