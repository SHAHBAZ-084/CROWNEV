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
  images?: { url: string; isPrimary: boolean }[];
}

export interface Branch {
  id: number;
  name: string;
  location: string;
  phone: string;
  whatsapp?: string | null;
  description?: string | null;
}

export interface Order {
  id: number;
  trackingId: string;
  status: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  type: string;
  createdAt: string;
  branch?: { name: string };
  items?: { product: { name: string }; quantity: number; unitPrice: string }[];
}

export interface Booking {
  id: number;
  status: string;
  date: string;
  time: string;
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
