export type Role = 'ADMIN' | 'BRANCH_OWNER' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
  branchId?: number | null;
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
  colorOptions?: string[] | null;
  brand?: { id: number; name: string } | null;
  category?: { id: number; name: string } | null;
  images?: { id?: number; url: string; isPrimary: boolean; sortOrder?: number }[];
  stockAtBranch?: number;
}

export interface Branch {
  id: number;
  name: string;
  location: string;
  phone: string;
  whatsapp?: string | null;
  description?: string | null;
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
  product?: { name: string; type: 'BIKE' | 'PART'; images?: { url: string }[] };
}

export interface Order {
  id: number;
  publicId?: string;
  trackingId?: string | null;
  saleReference?: string | null;
  cargoTrackingId?: string;
  branchId?: number;
  userId?: string;
  type: 'ONLINE' | 'POS';
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  bankTransferScreenshot?: string;
  paymentTransactionId?: string;
  customerName?: string;
  customerPhone?: string;
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
  trackingId?: string | null;
  saleReference?: string | null;
  cargoTrackingId?: string;
  date: string;
  deliveredAt?: string;
  branch: { name: string; location: string; phone: string; whatsapp?: string | null };
  customer: { name: string; email?: string; phone?: string; address?: string };
  items: {
    name: string;
    type: 'BIKE' | 'PART';
    quantity: number;
    unitPrice: number;
    total: number;
    color?: string;
    chassisNumber?: string;
  }[];
  subtotal: number;
  total: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
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
    name: string;
    type: 'BIKE' | 'PART';
    quantity: number;
    unitCost: number;
    total: number;
    chassisNumber?: string | null;
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
