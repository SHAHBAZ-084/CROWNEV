import { PrismaClient, Role, ProductType, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const seedDir = path.dirname(fileURLToPath(import.meta.url));
const SEED_BIKE_ASSETS = path.join(seedDir, 'seed-assets', 'bikes');
const UPLOAD_PRODUCTS_DIR = path.resolve(process.cwd(), 'uploads', 'products');

type BikeSeed = {
  slug: string;
  name: string;
  price: number;
  salePrice?: number;
  description: string;
  specs: Record<string, string>;
  colorOptions: string[];
  branchStock?: number;
};

type PartSeed = {
  slug: string;
  name: string;
  itemCode: string;
  price: number;
  salePrice?: number;
  description: string;
  costPrice: number;
  alertAt?: number;
  imageText: string;
  imageColor?: string;
  inventoryQty?: number;
};

const BIKE_SEEDS: BikeSeed[] = [
  {
    slug: 'crown-eve-pro-x1',
    name: 'Crown Ev Pro X1',
    price: 185000,
    salePrice: 175000,
    description: 'Premium electric bike with long range and smart features for daily commuting.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '800',
      motor_watt_max: '1000',
      battery_voltage: '60V',
      battery_capacity_ah: '32Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '40',
      speed_max_kmh: '45',
      range_eco_min_km: '70',
      range_eco_max_km: '80',
      speed_modes: '3',
      charger: '60V 5A',
      charging_time_min_hrs: '5',
      charging_time_max_hrs: '6',
      net_weight_kg: '68',
      loading_capacity_kg: '150',
      security: 'Key + Alarm',
      braking_system: 'Front & Rear Disc',
      frame_material: 'Steel Step-Through',
      wheel_size: 'Tubeless 16"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Matte Black', 'Pearl White', 'Electric Blue'],
    branchStock: 6,
  },
  {
    slug: 'crown-eve-city-cruiser',
    name: 'Crown Ev City Cruiser',
    price: 142000,
    salePrice: 135000,
    description: 'Comfort-focused city e-bike with upright riding position and smooth acceleration.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '650',
      motor_watt_max: '800',
      battery_voltage: '60V',
      battery_capacity_ah: '26Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '35',
      speed_max_kmh: '40',
      range_eco_min_km: '58',
      range_eco_max_km: '65',
      speed_modes: '3',
      charger: '60V 4A',
      charging_time_min_hrs: '4',
      charging_time_max_hrs: '5',
      net_weight_kg: '62',
      loading_capacity_kg: '130',
      security: 'Key Start',
      braking_system: 'Front Disc / Rear Drum',
      frame_material: 'Steel Commuter',
      wheel_size: 'Tubeless 16"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Graphite Grey', 'Forest Green'],
    branchStock: 8,
  },
  {
    slug: 'crown-eve-delivery-max',
    name: 'Crown Ev Delivery Max',
    price: 198000,
    description: 'Heavy-duty delivery e-bike with extended range and reinforced rear rack.',
    specs: {
      motor_type: 'High-Torque BLDC',
      motor_watt_min: '1000',
      motor_watt_max: '1200',
      battery_voltage: '72V',
      battery_capacity_ah: '35Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '45',
      speed_max_kmh: '50',
      range_eco_min_km: '85',
      range_eco_max_km: '95',
      speed_modes: '3',
      charger: '72V 6A',
      charging_time_min_hrs: '6',
      charging_time_max_hrs: '7',
      net_weight_kg: '74',
      loading_capacity_kg: '200',
      security: 'Key + GPS Ready',
      braking_system: 'Front & Rear Disc CBS',
      frame_material: 'Reinforced Steel Cargo',
      wheel_size: 'Tubeless 17"',
      warranty: '1 Year Battery / 6 Month Motor',
    },
    colorOptions: ['Matte Black', 'Safety Yellow'],
    branchStock: 4,
  },
  {
    slug: 'crown-eve-lite-s2',
    name: 'Crown Ev Lite S2',
    price: 118000,
    salePrice: 112000,
    description: 'Lightweight entry model ideal for students and short urban trips.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '500',
      motor_watt_max: '650',
      battery_voltage: '48V',
      battery_capacity_ah: '24Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '30',
      speed_max_kmh: '35',
      range_eco_min_km: '48',
      range_eco_max_km: '55',
      speed_modes: '2',
      charger: '48V 3A',
      charging_time_min_hrs: '3',
      charging_time_max_hrs: '4',
      net_weight_kg: '54',
      loading_capacity_kg: '120',
      security: 'Key Start',
      braking_system: 'Front & Rear Drum',
      frame_material: 'Lightweight Steel',
      wheel_size: 'Tubeless 14"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Sky Blue', 'Silver', 'White'],
    branchStock: 10,
  },
  {
    slug: 'crown-eve-trail-rider',
    name: 'Crown Ev Trail Rider',
    price: 165000,
    description: 'All-terrain e-bike with wider tyres and improved suspension for mixed roads.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '800',
      motor_watt_max: '1000',
      battery_voltage: '60V',
      battery_capacity_ah: '30Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '38',
      speed_max_kmh: '42',
      range_eco_min_km: '62',
      range_eco_max_km: '70',
      speed_modes: '3',
      charger: '60V 5A',
      charging_time_min_hrs: '5',
      charging_time_max_hrs: '6',
      net_weight_kg: '66',
      loading_capacity_kg: '160',
      security: 'Key + Alarm',
      braking_system: 'Front & Rear Disc',
      frame_material: 'Steel Adventure Frame',
      wheel_size: 'Knobby Tubeless 17"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Army Green', 'Matte Black'],
    branchStock: 5,
  },
];

const PART_SEEDS: PartSeed[] = [
  {
    slug: '60v-32ah-battery-pack',
    name: '60V 32Ah Battery Pack',
    itemCode: 'CE-BAT-60V-32AH',
    price: 52000,
    salePrice: 49000,
    description: 'Replacement lithium battery for Crown Ev 60V electric bikes.',
    costPrice: 45000,
    alertAt: 3,
    imageText: '60V+32Ah+Battery',
    inventoryQty: 12,
  },
  {
    slug: 'bldc-motor-1000w',
    name: 'BLDC Motor 1000W',
    itemCode: 'CE-MOT-1000W',
    price: 28000,
    description: 'High-torque brushless hub motor for Pro X1 and Trail Rider models.',
    costPrice: 24000,
    alertAt: 4,
    imageText: '1000W+Motor',
    imageColor: '334155',
    inventoryQty: 8,
  },
  {
    slug: 'lcd-display-panel',
    name: 'LCD Display Panel',
    itemCode: 'CE-DSP-LCD',
    price: 8500,
    salePrice: 7900,
    description: 'Speed, battery, and trip LCD dashboard for Crown Ev handlebars.',
    costPrice: 6200,
    alertAt: 5,
    imageText: 'LCD+Display',
    imageColor: '0f172a',
    inventoryQty: 15,
  },
  {
    slug: 'front-brake-pad-set',
    name: 'Front Brake Pad Set',
    itemCode: 'CE-BRK-FRT',
    price: 2200,
    description: 'OEM-compatible front disc brake pads for Crown Ev city and lite models.',
    costPrice: 1500,
    alertAt: 8,
    imageText: 'Brake+Pads',
    imageColor: '7c2d12',
    inventoryQty: 24,
  },
  {
    slug: 'tubeless-tyre-16',
    name: 'Tubeless Tyre 16"',
    itemCode: 'CE-TYR-16',
    price: 6500,
    description: 'All-weather 16-inch tubeless tyre for Crown Ev commuter bikes.',
    costPrice: 4800,
    alertAt: 6,
    imageText: 'Tyre+16in',
    imageColor: '1c1917',
    inventoryQty: 18,
  },
  {
    slug: '60v-5a-fast-charger',
    name: '60V 5A Fast Charger',
    itemCode: 'CE-CHG-60V5A',
    price: 9800,
    salePrice: 9200,
    description: 'Smart 60V fast charger with overcharge protection for Crown Ev batteries.',
    costPrice: 7200,
    alertAt: 4,
    imageText: '60V+Charger',
    imageColor: 'c2410c',
    inventoryQty: 10,
  },
  {
    slug: 'headlight-assembly-led',
    name: 'LED Headlight Assembly',
    itemCode: 'CE-LGT-LED',
    price: 4500,
    description: 'Bright LED headlight unit with integrated DRL for night riding safety.',
    costPrice: 3100,
    alertAt: 6,
    imageText: 'LED+Headlight',
    imageColor: 'fef08a',
    inventoryQty: 14,
  },
  {
    slug: 'rear-shock-absorber',
    name: 'Rear Shock Absorber',
    itemCode: 'CE-SHK-RR',
    price: 7200,
    description: 'Replacement rear shock for Trail Rider and Delivery Max models.',
    costPrice: 5400,
    alertAt: 5,
    imageText: 'Rear+Shock',
    imageColor: '475569',
    inventoryQty: 9,
  },
];

function productImageUrl(text: string, color = 'B34700') {
  return `https://placehold.co/800x600/${color}/FFFFFF?text=${text}`;
}

async function ensureBikeSeedImage(slug: string) {
  const filename = `seed-${slug}.webp`;
  const dest = path.join(UPLOAD_PRODUCTS_DIR, filename);
  const assetWebp = path.join(SEED_BIKE_ASSETS, `${slug}.webp`);

  await fs.promises.mkdir(UPLOAD_PRODUCTS_DIR, { recursive: true });

  if (!fs.existsSync(assetWebp)) {
    throw new Error(`Missing seed bike image: ${assetWebp}`);
  }

  await fs.promises.copyFile(assetWebp, dest);
  return `/uploads/products/${filename}`;
}

async function upsertPrimaryImage(productId: string, url: string) {
  const existing = await prisma.productImage.findFirst({
    where: { productId, isPrimary: true },
  });
  if (existing) {
    await prisma.productImage.update({ where: { id: existing.id }, data: { url } });
    return;
  }
  await prisma.productImage.create({
    data: { productId, url, isPrimary: true, sortOrder: 0 },
  });
}

async function listProductAtBranches(
  productId: string,
  branches: { id: number }[],
  stock = 0,
) {
  for (const branch of branches) {
    await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: branch.id, productId } },
      update: { isListed: true, stock },
      create: { branchId: branch.id, productId, isListed: true, stock },
    });
  }
}

async function stockPartAtBranches(
  partId: number,
  branches: { id: number }[],
  quantity: number,
) {
  for (const branch of branches) {
    await prisma.inventory.upsert({
      where: { branchId_partId: { branchId: branch.id, partId } },
      update: { quantity },
      create: { branchId: branch.id, partId, quantity },
    });
  }
}

async function upsertBikePartDetail(
  productId: string,
  partId: number,
  compatibleBikeIds: string[],
) {
  const existing = await prisma.bikePartDetail.findFirst({ where: { productId } });
  if (existing) {
    await prisma.bikePartDetail.update({
      where: { id: existing.id },
      data: {
        partId,
        modelCompatibility: 'Crown Ev models',
        compatibleBikeIds,
      },
    });
    return;
  }
  await prisma.bikePartDetail.create({
    data: {
      productId,
      partId,
      modelCompatibility: 'Crown Ev models',
      compatibleBikeIds,
    },
  });
}

async function main() {
  console.log('Seeding Crown Ev database...');

  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crown-eve.com' },
    update: {},
    create: {
      email: 'admin@crown-eve.com',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      isVerified: true,
      city: 'Karachi',
    },
  });

  const branch1 = await prisma.branch.upsert({
    where: { id: 1 },
    update: {
      latitude: 29.995378379735364,
      longitude: 73.24281476617726,
    },
    create: {
      name: 'Crown Ev Karachi',
      location: 'Main Boulevard, Karachi',
      phone: '+92 300 1234567',
      whatsapp: '+92 300 1234567',
      latitude: 29.995378379735364,
      longitude: 73.24281476617726,
      description:
        'Our Karachi branch has been serving the Clifton and DHA community since 2022, offering full sales, service, and genuine parts support for every Crown Ev model.',
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: 2 },
    update: {
      latitude: 29.806459600175703,
      longitude: 72.86913501963214,
    },
    create: {
      name: 'Crown Ev Lahore',
      location: 'MM Alam Road, Lahore',
      phone: '+92 321 9876543',
      whatsapp: '+92 321 9876543',
      latitude: 29.806459600175703,
      longitude: 72.86913501963214,
      description:
        'Located in the heart of Lahore, this branch provides test rides, financing guidance, and expert EV maintenance for riders across Punjab.',
    },
  });

  const ownerPassword = await bcrypt.hash('Owner@123', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner.karachi@crown-eve.com' },
    update: {},
    create: {
      email: 'owner.karachi@crown-eve.com',
      passwordHash: ownerPassword,
      firstName: 'Ahmed',
      lastName: 'Khan',
      role: Role.BRANCH_OWNER,
      branchId: branch1.id,
      isVerified: true,
      city: 'Karachi',
    },
  });

  await prisma.branch.update({
    where: { id: branch1.id },
    data: { ownerId: owner.id },
  });

  const customerPassword = await bcrypt.hash('Customer@123', 12);
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      firstName: 'Ali',
      lastName: 'Hassan',
      role: Role.CUSTOMER,
      isVerified: true,
      city: 'Islamabad',
      phone: '+92-333-1112233',
    },
  });

  const brand = await prisma.brand.upsert({
    where: { slug: 'crown-eve' },
    update: {},
    create: { name: 'Crown Ev', slug: 'crown-eve' },
  });

  const category = await prisma.productCategory.upsert({
    where: { slug: 'electric-bikes' },
    update: {},
    create: { name: 'Electric Bikes', slug: 'electric-bikes' },
  });

  await prisma.productCategory.upsert({
    where: { slug: 'parts-accessories' },
    update: {},
    create: { name: 'Parts & Accessories', slug: 'parts-accessories' },
  });

  const branches = [branch1, branch2];
  const bikeProducts: { id: string; slug: string }[] = [];

  for (const bike of BIKE_SEEDS) {
    const product = await prisma.product.upsert({
      where: { slug: bike.slug },
      update: {
        name: bike.name,
        price: bike.price,
        salePrice: bike.salePrice ?? null,
        description: bike.description,
        specs: bike.specs,
        colorOptions: bike.colorOptions,
        isActive: true,
      },
      create: {
        name: bike.name,
        slug: bike.slug,
        type: ProductType.BIKE,
        brandId: brand.id,
        categoryId: category.id,
        price: bike.price,
        salePrice: bike.salePrice,
        description: bike.description,
        specs: bike.specs,
        colorOptions: bike.colorOptions,
      },
    });

    await upsertPrimaryImage(product.id, await ensureBikeSeedImage(bike.slug));
    await listProductAtBranches(product.id, branches, bike.branchStock ?? 5);
    bikeProducts.push({ id: product.id, slug: bike.slug });
  }

  for (const partSeed of PART_SEEDS) {
    const partProduct = await prisma.product.upsert({
      where: { slug: partSeed.slug },
      update: {
        name: partSeed.name,
        price: partSeed.price,
        salePrice: partSeed.salePrice ?? null,
        description: partSeed.description,
        isActive: true,
      },
      create: {
        name: partSeed.name,
        slug: partSeed.slug,
        type: ProductType.PART,
        brandId: brand.id,
        price: partSeed.price,
        salePrice: partSeed.salePrice,
        description: partSeed.description,
      },
    });

    const part = await prisma.part.upsert({
      where: { itemCode: partSeed.itemCode },
      update: {
        name: partSeed.name,
        description: partSeed.description,
        costPrice: partSeed.costPrice,
        alertAt: partSeed.alertAt ?? 5,
        isActive: true,
      },
      create: {
        itemCode: partSeed.itemCode,
        name: partSeed.name,
        description: partSeed.description,
        costPrice: partSeed.costPrice,
        alertAt: partSeed.alertAt ?? 5,
      },
    });

    await upsertPrimaryImage(
      partProduct.id,
      productImageUrl(partSeed.imageText, partSeed.imageColor),
    );
    await listProductAtBranches(partProduct.id, branches, partSeed.inventoryQty ?? 10);
    await stockPartAtBranches(part.id, branches, partSeed.inventoryQty ?? 10);

    await upsertBikePartDetail(
      partProduct.id,
      part.id,
      bikeProducts.map((b) => b.id),
    );
  }

  const existingAccCategory = await prisma.accountCategory.findFirst({
    where: { branchId: branch1.id, name: 'Assets' },
  });
  const accCategory =
    existingAccCategory ??
    (await prisma.accountCategory.create({
      data: { branchId: branch1.id, name: 'Assets' },
    }));

  const existingCash = await prisma.account.findFirst({
    where: { branchId: branch1.id, code: '1001' },
  });
  if (!existingCash) {
    const cashAccount = await prisma.account.create({
      data: {
        branchId: branch1.id,
        categoryId: accCategory.id,
        name: 'Cash in Hand',
        code: '1001',
        type: AccountType.ASSET,
      },
    });

    await prisma.ledger.create({
      data: { branchId: branch1.id, accountId: cashAccount.id, balance: 0 },
    });
  }

  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
    await prisma.testimonial.create({
      data: {
        customerName: 'Usman Malik',
        content: 'Excellent service and great electric bikes. Highly recommended!',
        rating: 5,
        sortOrder: 0,
        status: 'APPROVED',
        isActive: true,
      },
    });
  }

  for (const [slug, title, content] of [
    ['about', 'About Crown Ev', 'Crown Ev Bikes is Pakistan\'s leading multi-branch EV bike retailer.'],
    ['privacy', 'Privacy Policy', 'We respect your privacy and protect your personal data.'],
    ['terms', 'Terms of Service', 'By using our services you agree to these terms and conditions.'],
  ] as const) {
    await prisma.contentPage.upsert({
      where: { slug },
      update: {},
      create: { slug, title, content },
    });
  }

  console.log('Seed complete.');
  console.log(`Catalog: ${BIKE_SEEDS.length} bikes, ${PART_SEEDS.length} parts (listed at both branches).`);
  console.log('Admin: admin@crown-eve.com / Admin@123');
  console.log('Branch Owner: owner.karachi@crown-eve.com / Owner@123');
  console.log('Customer: customer@example.com / Customer@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
