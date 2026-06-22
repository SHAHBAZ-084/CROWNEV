import type {
  Booking,
  Branch,
  LandingData,
  Order,
  Paginated,
  Product,
  User,
} from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Upload failed');
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    city?: string;
  }) =>
    api<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyOtp: (email: string, otp: string) =>
    api<{ token: string; user: User }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),
  forgotPassword: (email: string) =>
    api<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    api<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),
  me: () => api<User>('/auth/me'),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; city?: string }) =>
    api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

export const publicApi = {
  landing: () => api<LandingData>('/public/landing'),
  shop: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Product>>(`/products/shop${q}`);
  },
  product: (id: string) => api<Product>(`/products/shop/${id}`),
  categories: () => api<{ id: number; name: string; slug: string; children?: unknown[] }[]>('/products/categories'),
  brands: () => api<{ id: number; name: string; slug: string }[]>('/products/brands'),
  branches: () => api<Branch[]>('/branches/public'),
  services: (branchId: number) => api<{ id: number; name: string; basePrice: string; duration: number }[]>(`/services/public/${branchId}`),
  trackOrder: (trackingId: string) => api<Order>(`/orders/track/${trackingId}`),
  contact: (data: { name: string; email: string; phone?: string; message: string; branchId?: number }) =>
    api<{ message: string }>('/contact', { method: 'POST', body: JSON.stringify(data) }),
  page: (slug: string) => api<{ title: string; content: string }>(`/public/pages/${slug}`),
  testimonials: () => api<{ customerName: string; content: string; rating: number }[]>('/testimonials'),
};

export const customerApi = {
  orders: () => api<Paginated<Order>>('/orders'),
  order: (id: number) => api<Order>(`/orders/${id}`),
  orderInvoice: (id: number) => api<Record<string, unknown>>(`/orders/${id}/invoice`),
  checkout: (data: {
    branchId: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    items: { productId: string; quantity: number; color?: string }[];
    notes?: string;
    bankTransferScreenshot?: string;
  }) =>
    api<Order>('/orders/online', { method: 'POST', body: JSON.stringify(data) }),
  bookings: () => api<Paginated<Booking>>('/bookings'),
  createBooking: (data: {
    branchId: number;
    serviceId: number;
    date: string;
    time: string;
    notes?: string;
  }) => api<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; city?: string }) =>
    authApi.updateProfile(data),
};

export const adminApi = {
  dashboard: () => api<Record<string, unknown>>('/reports/admin/dashboard'),
  branches: () => api<unknown[]>('/branches'),
  createBranch: (data: { name: string; location: string; phone: string; whatsapp?: string; description?: string }) =>
    api<unknown>('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBranch: (id: number) =>
    api<{ deactivated: boolean }>(`/branches/${id}`, { method: 'DELETE' }),
  products: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Product>>(`/products${q}`);
  },
  createProduct: (data: Record<string, unknown>) =>
    api<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    api<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => api<void>(`/products/${id}`, { method: 'DELETE' }),
  uploadProductImages: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return apiUpload<{ urls: string[] }>('/products/upload-images', form);
  },
  addProductImage: (productId: string, url: string, isPrimary = false, sortOrder = 0) =>
    api<{ id: number; url: string }>(`/products/${productId}/images`, {
      method: 'POST',
      body: JSON.stringify({ url, isPrimary, sortOrder }),
    }),
  setProductImagePrimary: (productId: string, imageId: number) =>
    api<{ id: number; url: string; isPrimary: boolean }>(`/products/${productId}/images/${imageId}/primary`, {
      method: 'PATCH',
    }),
  deleteProductImage: (productId: string, imageId: number) =>
    api<void>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
  parts: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<unknown>>(`/parts${q}`);
  },
  createPart: (data: { itemCode: string; name: string; description?: string; costPrice: number; alertAt?: number }) =>
    api<unknown>('/parts', { method: 'POST', body: JSON.stringify(data) }),
  updatePart: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePart: (id: number) => api<void>(`/parts/${id}`, { method: 'DELETE' }),
  users: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<User>>(`/users${q}`);
  },
  createUser: (data: Record<string, unknown>) =>
    api<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    api<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) => api<void>(`/users/${id}`, { method: 'DELETE' }),
  orders: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Order>>(`/orders${q}`);
  },
  updateOrderStatus: (id: number, status: string) =>
    api<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bookings: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Booking>>(`/bookings${q}`);
  },
  updateBookingStatus: (id: number, data: { branchId: number; status: string }) =>
    api<Booking>(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  pendingPayments: () => api<Order[]>('/orders/pending-payments'),
  approvePayment: (id: number, approved: boolean) =>
    api<Order>(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ approved }) }),
  revenue: (days = 30) => api<{ date: string; revenue: number }[]>(`/reports/revenue?days=${days}`),
  testimonials: () => api<unknown[]>('/testimonials/pending'),
  testimonialsAll: () => api<unknown[]>('/testimonials'),
  createTestimonial: (data: Record<string, unknown>) =>
    api<unknown>('/testimonials', { method: 'POST', body: JSON.stringify(data) }),
  updateTestimonial: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/testimonials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestimonial: (id: number) => api<void>(`/testimonials/${id}`, { method: 'DELETE' }),
  approveTestimonial: (id: number) =>
    api<unknown>(`/testimonials/${id}/approve`, { method: 'PATCH' }),
  rejectTestimonial: (id: number) =>
    api<unknown>(`/testimonials/${id}/reject`, { method: 'PATCH' }),
  brands: () => publicApi.brands(),
  categories: () => publicApi.categories(),
};

export const branchApi = {
  dashboard: (branchId: number) =>
    api<Record<string, unknown>>(`/branches/${branchId}/dashboard`),
  todayBookings: (branchId: number) => api<Booking[]>(`/bookings/today/${branchId}`),
  orders: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Order>>(`/orders${q}`);
  },
  updateOrderStatus: (id: number, status: string) =>
    api<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bookings: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Booking>>(`/bookings${q}`);
  },
  updateBookingStatus: (id: number, data: { branchId: number; status: string; parts?: { partId: number; quantity: number }[] }) =>
    api<Booking>(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  inventory: (branchId: number) => api<Paginated<{ id?: number; quantity: number; partId: number; part: { id: number; name: string; itemCode: string; alertAt: number } }>>(`/inventory/${branchId}`),
  setStock: (branchId: number, partId: number, quantity: number) =>
    api<unknown>(`/inventory/${branchId}/${partId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  adjustStock: (branchId: number, data: { partId: number; quantityChange: number; reason: string; notes?: string }) =>
    api<unknown>(`/inventory/${branchId}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  lowStock: (branchId: number) => api<unknown[]>(`/inventory/${branchId}/low-stock`),
  posOrder: (data: {
    branchId: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    items: { productId: string; quantity: number }[];
    walkInCustomerId?: number;
    isPaid?: boolean;
    notes?: string;
  }) => api<Order>('/orders/pos', { method: 'POST', body: JSON.stringify(data) }),
  services: (branchId: number) => api<unknown[]>(`/services/${branchId}`),
  createService: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/services/${branchId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateService: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/services/${branchId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (branchId: number, id: number) =>
    api<void>(`/services/${branchId}/${id}`, { method: 'DELETE' }),
  shopProducts: (branchId: number) => api<unknown[]>(`/branches/${branchId}/products`),
  setProductListed: (branchId: number, productId: string, isListed: boolean) =>
    api<unknown>(`/branches/${branchId}/products/${productId}`, { method: 'PUT', body: JSON.stringify({ isListed }) }),
  pendingPayments: () => api<Order[]>('/orders/pending-payments'),
  approvePayment: (id: number, approved: boolean) =>
    api<Order>(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ approved }) }),
  orderInvoice: (id: number) => api<Record<string, unknown>>(`/orders/${id}/invoice`),
  bookingReceipt: (id: number) => api<Record<string, unknown>>(`/bookings/${id}/receipt`),
  suppliers: (branchId: number) => api<Paginated<unknown>>(`/suppliers?branchId=${branchId}`),
  createSupplier: (data: Record<string, unknown>) =>
    api<unknown>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  purchases: (branchId: number) => api<Paginated<unknown>>(`/purchases?branchId=${branchId}`),
  createPurchase: (data: Record<string, unknown>) =>
    api<unknown>('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  purchase: (id: number) => api<unknown>(`/purchases/${id}`),
  accountingCategories: (branchId: number) => api<unknown[]>(`/accounting/${branchId}/categories`),
  createAccountCategory: (branchId: number, name: string) =>
    api<unknown>(`/accounting/${branchId}/categories`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteAccountCategory: (branchId: number, id: number) =>
    api<unknown>(`/accounting/${branchId}/categories/${id}`, { method: 'DELETE' }),
  accounts: (branchId: number) => api<unknown[]>(`/accounting/${branchId}/accounts`),
  createAccount: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/accounts`, { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (branchId: number, id: number) =>
    api<unknown>(`/accounting/${branchId}/accounts/${id}`, { method: 'DELETE' }),
  vouchers: (branchId: number) => api<unknown[]>(`/accounting/${branchId}/vouchers`),
  createVoucher: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/vouchers`, { method: 'POST', body: JSON.stringify(data) }),
  deleteVoucher: (branchId: number, voucherId: number) =>
    api<unknown>(`/accounting/${branchId}/vouchers/${voucherId}`, { method: 'DELETE' }),
  restoreVoucher: (branchId: number, voucherId: number) =>
    api<unknown>(`/accounting/${branchId}/vouchers/${voucherId}/restore`, { method: 'POST' }),
  banks: (branchId: number) => api<unknown[]>(`/accounting/${branchId}/banks`),
  createBank: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/banks`, { method: 'POST', body: JSON.stringify(data) }),
  updateBank: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  trialBalance: (branchId: number) => api<unknown>(`/accounting/${branchId}/trial-balance`),
  ledger: (branchId: number, accountId: number, params?: { fromDate?: string; toDate?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<unknown>(`/accounting/${branchId}/ledger/${accountId}${q}`);
  },
  walkInCustomers: (branchId: number) => api<Paginated<unknown>>(`/walk-in/${branchId}/customers`),
  createWalkInCustomer: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers`, { method: 'POST', body: JSON.stringify(data) }),
  updateWalkInCustomer: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWalkInCustomer: (branchId: number, id: number) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'DELETE' }),
  parts: () => adminApi.parts(),
};
