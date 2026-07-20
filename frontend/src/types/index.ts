export type Role = 'ADMIN' | 'BRANCH_OWNER' | 'CUSTOMER';

export type BranchPermission = 'WRITE_ONLY' | 'WRITE_UPDATE' | 'WRITE_UPDATE_DELETE';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
  branchId?: number | null;
  branchPermission?: BranchPermission;
  hasPassword?: boolean;
}

export interface ColorOption {
  name: string;
  imageUrl: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: 'BIKE' | 'PART';
  price: string;
  salePrice?: string | null;
  description?: string | null;
  specs?: Record<string, string> | null;
  colorOptions?: (string | ColorOption)[] | null;
  brand?: { id: number; name: string } | null;

  category?: { id: number; name: string } | null;
  images?: { id?: number; url: string; isPrimary: boolean; sortOrder?: number }[];
  stockAtBranch?: number;
  model?: string | null;
  listingOrder?: number;
}

export interface Branch {
  id: number;
  name: string;
  location: string;
  phone: string;
  whatsapp?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  showOnPublicSite?: boolean;
}

export interface PaymentChannel {
  id: number;
  type: 'BANK' | 'WALLET';
  name: string;
  accountTitle?: string | null;
  accountNumber: string;
  isActive?: boolean;
}

export interface OrderItem {
  id?: number;
  productId: string;
  quantity: number;
  unitPrice: string;
  total: string;
  color?: string;
  chassisNumber?: string;
  engineNumber?: string;
  motorNumber?: string;
  product?: { name: string; type: 'BIKE' | 'PART'; images?: { url: string }[] };
}

export type OrderStatus =
  | 'AWAITING_BILTY_CHARGES'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'CONFIRMED'
  | 'CANCELLED';

export type ShippingMethod = 'BILTY' | 'SELF';

export interface Order {
  id: number;
  publicId?: string;
  saleReference?: string | null;
  biltyId?: string | null;
  biltyCharges?: string | null;
  shippingProvider?: string | null;
  shippingMethod?: ShippingMethod | null;
  branchId?: number;
  userId?: string;
  type: 'ONLINE' | 'POS';
  status: OrderStatus;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  bankTransferScreenshot?: string;
  paymentTransactionId?: string;
  customerName?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  customerAddress?: string;
  subtotal?: string;
  total: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  branch?: { id?: number; name: string; location?: string; phone?: string; whatsapp?: string };
  user?: { firstName: string; lastName: string; email: string; phone?: string };
  customer?: { name: string; cnic?: string; phone?: string; address?: string; type?: 'ONLINE' | 'WALK_IN' };
  /** @deprecated use customer */
  walkInCustomer?: { name: string; cnic?: string; phone?: string; address?: string };
  items?: OrderItem[];
}

export interface InvoiceData {
  invoiceAvailable: boolean;
  invoiceType: 'SALE';
  currency: 'PKR';
  invoiceNumber: string;
  orderType?: 'ONLINE' | 'POS';
  shippingMethod?: ShippingMethod | null;
  saleReference?: string | null;
  biltyId?: string | null;
  shippingProvider?: string | null;
  biltyCharges?: number | null;
  date: string;
  branch: { name: string; location: string; phone: string; whatsapp?: string | null };
  customer: { name: string; email?: string; phone?: string; address?: string };
  items: {
    orderItemId?: number;
    name: string;
    type: 'BIKE' | 'PART';
    quantity: number;
    unitPrice: number;
    total: number;
    color?: string | null;
    chassisNumber?: string;
    engineNumber?: string | null;
    motorNumber?: string | null;
    chassisId?: number;
    identityLocked?: boolean;
    brand?: string;
    category?: string;
    model?: string;
    batteryVoltage?: string;
    batteryCapacityAh?: string;
    colorOptions?: (string | ColorOption)[] | null;
  }[];
  subtotal: number;
  total: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  status: OrderStatus;
  notes?: string;
}

export interface PurchaseInvoiceData {
  invoiceAvailable: boolean;
  invoiceType: 'PURCHASE';
  currency: 'PKR';
  invoiceNumber: string;
  reference: string | null;
  date: string;
  branch: { name: string; location: string; phone: string; whatsapp?: string | null };
  supplier: {
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  items: {
    purchaseItemId?: number;
    name: string;
    type: 'BIKE' | 'PART';
    quantity: number;
    unitCost: number;
    total: number;
    chassisNumber?: string | null;
    bikeUnits?: {
      chassisId?: number;
      chassisNumber: string;
      engineNumber: string | null;
      motorNumber: string | null;
      color?: string | null;
      isUsed?: boolean;
      condition?: string | null;
      meterReading?: number | null;
      comments?: string | null;
      purchasePrice?: number | null;
      identityLocked?: boolean;
      removable?: boolean;
    }[];
    brand?: string;
    category?: string;
    model?: string;
    batteryVoltage?: string;
    batteryCapacityAh?: string;
    colorOptions?: (string | ColorOption)[] | null;
  }[];
  subtotal: number;
  total: number;
  notes?: string | null;
}

export interface ServiceInvoiceData {
  invoiceAvailable: boolean;
  invoiceType: 'SERVICE';
  currency: 'PKR';
  invoiceNumber: string;
  reference: string;
  date: string;
  branch: { name: string; location: string; phone: string; whatsapp?: string | null };
  customer: { name: string; email?: string; phone?: string; address?: string };
  items: {
    name: string;
    type: 'BIKE' | 'PART';
    quantity: number;
    unitPrice: number;
    total: number;
    color?: string | null;
  }[];
  labourCost: number;
  partsTotal: number;
  subtotal: number;
  total: number;
  notes?: string;
}

export interface Booking {
  id: number;
  status: string;
  date?: string | null;
  time?: string | null;
  confirmedTime?: string | null;
  notes?: string;
  service?: { name: string; basePrice: string };
  branch?: { name: string };
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface LandingData {
  testimonials: { id: number; customerName: string; content: string; rating: number }[];
  branches: Branch[];
  categories: { id: number; name: string; slug: string }[];
  brands: { id: number; name: string; slug: string }[];
  featuredProducts: Product[];
  stats: { branches: number; products: number; ordersDelivered: number };
}
