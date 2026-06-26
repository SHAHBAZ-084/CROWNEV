/**
 * Enum values mirrored from prisma/schema.prisma.
 * Used for type-checking when Prisma Client cannot be generated (offline CI / blocked binaries).
 * After changing schema enums, run: npm run db:sync-enums
 */

export const Role = {
  ADMIN: 'ADMIN',
  BRANCH_OWNER: 'BRANCH_OWNER',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const OtpType = {
  REGISTRATION: 'REGISTRATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type OtpType = (typeof OtpType)[keyof typeof OtpType];

export const ProductType = {
  BIKE: 'BIKE',
  PART: 'PART',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const OrderType = {
  ONLINE: 'ONLINE',
  POS: 'POS',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderStatus = {
  AWAITING_BILTY_CHARGES: 'AWAITING_BILTY_CHARGES',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ShippingMethod = {
  BILTY: 'BILTY',
  SELF: 'SELF',
} as const;
export type ShippingMethod = (typeof ShippingMethod)[keyof typeof ShippingMethod];

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const BookingStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const ChassisStatus = {
  IN_STOCK: 'IN_STOCK',
  SOLD: 'SOLD',
} as const;
export type ChassisStatus = (typeof ChassisStatus)[keyof typeof ChassisStatus];
