import type {
  Booking,
  Branch,
  InvoiceData,
  LandingData,
  Order,
  Paginated,
  PaymentChannel,
  Product,
  PurchaseInvoiceData,
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
    const message = err.error ?? err.message ?? 'Request failed';
    if (Array.isArray(err.details)) {
      throw new Error(err.details.join(', ') || message);
    }
    throw new Error(typeof message === 'string' ? message : 'Request failed');
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
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
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
  paymentChannels: (branchId: number) =>
    api<PaymentChannel[]>(`/branches/public/${branchId}/payment-channels`),
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
  orderInvoice: (id: number) => api<InvoiceData>(`/orders/${id}/invoice`),
  uploadPaymentScreenshot: (file: File) => {
    const form = new FormData();
    form.append('screenshot', file);
    return apiUpload<{ url: string }>('/orders/upload-screenshot', form);
  },
  checkout: (data: {
    branchId: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    items: { productId: string; quantity: number; color?: string; chassisNumber?: string }[];
    notes?: string;
    bankTransferScreenshot?: string;
    paymentTransactionId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
  }) =>
    api<Order>('/orders/online', { method: 'POST', body: JSON.stringify(data) }),
  bookings: () => api<Paginated<Booking>>('/bookings'),
  bookingReceipt: (id: number) => api<Record<string, unknown>>(`/bookings/${id}/receipt`),
  createBooking: (data: { branchId: number; notes?: string }) =>
    api<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; city?: string }) =>
    authApi.updateProfile(data),
  changePassword: (currentPassword: string, newPassword: string) =>
    authApi.changePassword(currentPassword, newPassword),
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
  exportOrders: (params?: { branchId?: string }) => {
    const q = params?.branchId ? `?branchId=${params.branchId}` : '';
    return api<Record<string, unknown>[]>(`/reports/export/orders${q}`);
  },
  bookings: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Booking>>(`/bookings${q}`);
  },
  exportBookings: (params?: { branchId?: string }) => {
    const q = params?.branchId ? `?branchId=${params.branchId}` : '';
    return api<Record<string, unknown>[]>(`/reports/export/bookings${q}`);
  },
  revenue: (days = 30) => api<{ date: string; revenue: number }[]>(`/reports/revenue?days=${days}`),
  testimonials: () => api<unknown[]>('/testimonials/pending'),
  testimonialsAll: () => api<unknown[]>('/testimonials/all'),
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
  updateBookingStatus: (id: number, data: {
    branchId: number;
    status: string;
    confirmedTime?: string;
    date?: string;
    serviceId?: number;
    parts?: { partId: number; quantity: number }[];
  }) =>
    api<Booking>(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBooking: (id: number, branchId: number) =>
    api<void>(`/bookings/${id}?branchId=${branchId}`, { method: 'DELETE' }),
  inventory: (branchId: number) => api<Paginated<{ id?: number; quantity: number; partId: number; part: { id: number; name: string; itemCode: string; alertAt: number } }>>(`/inventory/${branchId}`),
  branchStock: (branchId: number) => api<{
    summary: {
      totalBikes: number;
      totalParts: number;
      bikesInStock: number;
      partsInStock: number;
      lowStockCount: number;
      totalUnits: number;
    };
    items: {
      type: 'BIKE' | 'PART';
      source: 'PRODUCT' | 'SERVICE_PART';
      id: string | number;
      name: string;
      code: string;
      quantity: number;
      alertAt: number;
      isLowStock: boolean;
      isSelected: boolean;
    }[];
    lowStock: {
      type: 'BIKE' | 'PART';
      source: 'PRODUCT' | 'SERVICE_PART';
      id: string | number;
      name: string;
      code: string;
      quantity: number;
      alertAt: number;
      isLowStock: boolean;
      isSelected: boolean;
    }[];
  }>(`/inventory/${branchId}/stock`),
  setStock: (branchId: number, partId: number, quantity: number) =>
    api<unknown>(`/inventory/${branchId}/${partId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  removePartFromBranch: (branchId: number, partId: number) =>
    api<void>(`/inventory/${branchId}/${partId}`, { method: 'DELETE' }),
  adjustStock: (branchId: number, data: { partId: number; quantityChange: number; reason: string; notes?: string }) =>
    api<unknown>(`/inventory/${branchId}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  lowStock: (branchId: number) => api<unknown[]>(`/inventory/${branchId}/low-stock`),
  posOrder: (data: {
    branchId: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    items: { productId: string; quantity: number }[];
    walkInCustomerId?: number;
    customerId?: number;
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
  saleProducts: (branchId: number) => api<{
    id: string;
    name: string;
    type: 'BIKE' | 'PART';
    stockAtBranch: number;
    unitPrice: number;
    brand?: { name: string } | null;
  }[]>(`/branches/${branchId}/sale-products`),
  createSaleInvoice: (data: {
    branchId: number;
    customerId: number;
    items: { productId: string; quantity: number; unitPrice?: number }[];
    reference: string;
    notes?: string;
  }) => api<{ order: Order; voucher: unknown }>('/orders/sale-invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  customerLedger: (branchId: number, customerId: number) =>
    api<{
      customer: { id: number; name: string; code: string; balance: number };
      rows: {
        date: string;
        voucherNo: string;
        ref: string | null;
        type: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
      }[];
      summary: { totalDebit: number; totalCredit: number; closingBalance: number };
    }>(`/walk-in/${branchId}/customers/${customerId}/ledger`),
  supplierLedger: (branchId: number, supplierId: number) =>
    api<{
      supplier: { id: number; name: string; code: string; balance: number };
      rows: {
        date: string;
        voucherNo: string;
        ref: string | null;
        type: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
      }[];
      summary: { totalDebit: number; totalCredit: number; closingBalance: number };
    }>(`/suppliers/${branchId}/${supplierId}/ledger`),
  setProductListed: (branchId: number, productId: string, isListed: boolean) =>
    api<unknown>(`/branches/${branchId}/products/${productId}`, { method: 'PUT', body: JSON.stringify({ isListed }) }),
  setBikeStock: (branchId: number, productId: string, quantity: number) =>
    api<unknown>(`/branches/${branchId}/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  pendingPayments: () => api<Order[]>('/orders/pending-payments'),
  approvePayment: (id: number, approved: boolean) =>
    api<Order>(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ approved }) }),
  setCargoTracking: (orderId: number, cargoTrackingId: string) =>
    api<Order>(`/orders/${orderId}/cargo-tracking`, {
      method: 'PATCH',
      body: JSON.stringify({ cargoTrackingId }),
    }),
  orderInvoice: (id: number) => api<InvoiceData>(`/orders/${id}/invoice`),
  paymentChannels: (branchId: number) => api<PaymentChannel[]>(`/branches/${branchId}/payment-channels`),
  createPaymentChannel: (branchId: number, data: {
    type: 'BANK' | 'WALLET';
    name: string;
    accountTitle?: string;
    accountNumber: string;
  }) => api<PaymentChannel>(`/branches/${branchId}/payment-channels`, { method: 'POST', body: JSON.stringify(data) }),
  updatePaymentChannel: (branchId: number, channelId: number, data: Partial<{
    type: 'BANK' | 'WALLET';
    name: string;
    accountTitle: string;
    accountNumber: string;
    isActive: boolean;
  }>) => api<PaymentChannel>(`/branches/${branchId}/payment-channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePaymentChannel: (branchId: number, channelId: number) =>
    api<void>(`/branches/${branchId}/payment-channels/${channelId}`, { method: 'DELETE' }),
  bookingReceipt: (id: number) => api<Record<string, unknown>>(`/bookings/${id}/receipt`),
  suppliers: (branchId: number) => api<Paginated<unknown>>(`/suppliers?branchId=${branchId}`),
  createSupplier: (data: Record<string, unknown>) =>
    api<unknown>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSupplier: (branchId: number, id: number) =>
    api<unknown>(`/suppliers/${id}`, { method: 'DELETE', body: JSON.stringify({ branchId }) }),
  purchaseProducts: (branchId: number) => api<{ id: string; name: string; type: 'BIKE' | 'PART' }[]>(
    `/branches/${branchId}/purchase-products`,
  ),
  createPurchaseInvoice: (data: {
    branchId: number;
    supplierId: number;
    reference: string;
    items: { productId: string; quantity: number; unitCost: number }[];
    notes?: string;
  }) => api<{ purchase: unknown; voucher: unknown }>('/purchases/invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  purchases: (branchId: number, params?: { limit?: string }) => {
    const q = new URLSearchParams({ branchId: String(branchId), ...(params?.limit ? { limit: params.limit } : {}) });
    return api<Paginated<unknown>>(`/purchases?${q}`);
  },
  createPurchase: (data: Record<string, unknown>) =>
    api<unknown>('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  purchase: (id: number) => api<unknown>(`/purchases/${id}`),
  purchaseInvoice: (id: number) => api<PurchaseInvoiceData>(`/purchases/${id}/invoice`),
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
  branchSuppliers: (branchId: number) => api<Paginated<unknown>>(`/accounting/${branchId}/suppliers`),
  branchCustomers: (branchId: number) => api<Paginated<unknown>>(`/accounting/${branchId}/customers`),
  walkInCustomers: (branchId: number) => api<Paginated<unknown>>(`/walk-in/${branchId}/customers`),
  createWalkInCustomer: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers`, { method: 'POST', body: JSON.stringify(data) }),
  updateWalkInCustomer: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWalkInCustomer: (branchId: number, id: number) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'DELETE' }),
  parts: () => adminApi.parts(),
};
