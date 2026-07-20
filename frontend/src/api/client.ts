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
  ServiceInvoiceData,
  User,
} from '../types';
import { enqueueRequest } from '../lib/apiQueue';
import { fetchWithRetry } from '../lib/queryRetry';
import type { AboutHeroSection, HomeHeroSection } from '../lib/placeholders';
import type { LegalSection } from '../lib/legalTypes';
import type { FaqItem } from '../lib/faqContent';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

/** Paths where 401 is expected (login flows) — do not force logout. */
const AUTH_401_SKIP = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-otp',
  '/auth/me',
];

function shouldForceLogoutOn401(path: string, hadToken: boolean) {
  if (!hadToken) return false;
  return !AUTH_401_SKIP.some((prefix) => path.startsWith(prefix));
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('crownev:unauthorized'));
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const method = (options.method ?? 'GET').toUpperCase();
  const run = async () => {
    const res = await fetchWithRetry(`${BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401 && shouldForceLogoutOn401(path, !!token)) {
        notifyUnauthorized();
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(
          'Server unavailable (502). Start the backend API on port 3001 and ensure PostgreSQL is running.',
        );
      }
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = err.error ?? err.message ?? 'Request failed';
      if (Array.isArray(err.details)) {
        throw new Error(err.details.join(', ') || message);
      }
      throw new Error(typeof message === 'string' ? message : 'Request failed');
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  };

  return method === 'GET' || method === 'HEAD'
    ? enqueueRequest(run)
    : run();
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(`${BASE}${path}`, { method: 'POST', body: formData, headers }, { enabled: false });
  if (!res.ok) {
    if (res.status === 401 && shouldForceLogoutOn401(path, !!token)) {
      notifyUnauthorized();
    }
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
  googleLogin: (idToken: string) =>
    api<{ token: string; user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
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
  deleteAccount: (data: { currentPassword?: string; confirmEmail?: string }) =>
    api<{ message: string }>('/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const publicApi = {
  landing: () => api<LandingData>('/public/landing'),
  shop: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Product>>(`/products/shop${q}`);
  },
  shopFilters: () =>
    api<{ brands: { id: number; name: string; slug: string }[]; categories: { id: number; name: string; slug: string; children?: unknown[] }[] }>(
      '/products/shop-filters',
    ),
  product: (id: string) => api<Product>(`/products/shop/${id}`),
  categories: () => api<{ id: number; name: string; slug: string; children?: unknown[] }[]>('/products/categories'),
  brands: () => api<{ id: number; name: string; slug: string }[]>('/products/brands'),
  bikeModels: () => api<{ id: number; name: string }[]>('/products/bike-models'),
  partsByModel: (model: string) =>
    api<
      {
        id: string;
        slug: string;
        name: string;
        price: string;
        salePrice?: string | null;
        type: 'PART';
        image: string | null;
        images?: { url: string; isPrimary: boolean }[];
      }[]
    >(`/public/parts-by-model?model=${encodeURIComponent(model)}`),
  branches: (opts?: { visibleOnly?: boolean }) =>
    api<Branch[]>(`/branches/public${opts?.visibleOnly ? '?visibleOnly=1' : ''}`),
  paymentChannels: (branchId: number) =>
    api<PaymentChannel[]>(`/branches/public/${branchId}/payment-channels`),
  services: (branchId: number) => api<{ id: number; name: string; basePrice: string; duration: number }[]>(`/services/public/${branchId}`),
  trackOrder: (publicId: string) => api<Order>(`/orders/track/${publicId}`),
  bookingTicket: (id: number, email: string) =>
    api<Record<string, unknown>>(
      `/bookings/public/${id}/ticket?email=${encodeURIComponent(email)}`,
    ),
  contact: (data: { name: string; email: string; phone?: string; message: string; branchId?: number }) =>
    api<{ message: string }>('/contact', { method: 'POST', body: JSON.stringify(data) }),
  page: (slug: string) => api<{ title: string; content: string }>(`/public/pages/${slug}`),
  testimonials: () => api<{ customerName: string; content: string; rating: number }[]>('/testimonials'),
  founders: () =>
    api<{
      eyebrow: string;
      title: string;
      subtitle: string;
      founders: { name: string; title: string; vision: string; bio: string; image: string }[];
    }>('/public/founders'),
  features: () =>
    api<{
      eyebrow: string;
      title: string;
      subtitle: string;
      features: { icon: string; title: string; desc: string; stat: string; statLabel: string }[];
    }>('/public/features'),
  footerContact: () =>
    api<{
      email: string;
      phones: string[];
      address: string;
    }>('/public/footer-contact'),
  partsFulfillmentBranch: () => api<{ branchId: number | null }>('/public/parts-fulfillment-branch'),
  availableBikeColors: (productId: string) =>
    api<string[]>(`/public/products/${productId}/available-colors`),
  aboutHero: () => api<AboutHeroSection>('/public/about-hero'),
  homeHero: () => api<HomeHeroSection>('/public/home-hero'),
  terms: () => api<LegalSection[]>('/public/terms'),
  privacy: () => api<LegalSection[]>('/public/privacy'),
  faq: () => api<FaqItem[]>('/public/faq'),
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
    shippingMethod: 'BILTY' | 'SELF';
    items: { productId: string; quantity: number; color?: string; chassisNumber?: string }[];
    notes?: string;
    bankTransferScreenshot?: string;
    paymentTransactionId?: string;
    customerName?: string;
    customerPhone?: string;
    customerWhatsapp?: string;
    customerAddress?: string;
  }) =>
    api<Order>('/orders/online', { method: 'POST', body: JSON.stringify({ ...data, paymentMethod: 'BANK_TRANSFER' }) }),
  submitOrderPayment: (orderId: number, data: { paymentTransactionId: string; bankTransferScreenshot: string }) =>
    api<Order>(`/orders/${orderId}/submit-payment`, { method: 'PATCH', body: JSON.stringify(data) }),
  bookings: () => api<Paginated<Booking>>('/bookings'),
  bookingReceipt: (id: number) => api<Record<string, unknown>>(`/bookings/${id}/receipt`),
  createBooking: (data: { branchId: number; notes?: string }) =>
    api<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; city?: string }) =>
    authApi.updateProfile(data),
  changePassword: (currentPassword: string, newPassword: string) =>
    authApi.changePassword(currentPassword, newPassword),
  deleteAccount: (data: { currentPassword?: string; confirmEmail?: string }) =>
    authApi.deleteAccount(data),
};

export const adminApi = {
  dashboard: () => api<Record<string, unknown>>('/reports/admin/dashboard'),
  branches: () => api<unknown[]>('/branches'),
  createBranch: (data: {
    name: string;
    location: string;
    phone: string;
    whatsapp?: string;
    description?: string;
    imageUrl?: string;
    showOnPublicSite?: boolean;
  }) => api<unknown>('/branches', { method: 'POST', body: JSON.stringify(data) }),
  uploadBranchImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiUpload<{ url: string }>('/branches/upload-image', form);
  },
  updateBranch: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBranch: (id: number, password: string) =>
    api<{ deleted: boolean }>(`/branches/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
  branchClearPreview: (id: number) =>
    api<{
      branchId: number;
      branchName: string;
      counts: Record<string, number>;
    }>(`/branches/${id}/clear-preview`),
  clearBranchData: (id: number, confirmName: string, password: string) =>
    api<{ branchId: number; branchName: string; deleted: Record<string, number> }>(
      `/branches/${id}/clear-data`,
      { method: 'POST', body: JSON.stringify({ confirmName, password }) },
    ),
  products: (params?: Record<string, string>, init?: RequestInit) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Product>>(`/products${q}`, init);
  },
  getProduct: (id: string) => api<Product>(`/products/${id}`),
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
  setUserPassword: (id: string, newPassword: string) =>
    api<{ message: string }>(`/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    }),
  deleteUser: (id: string) => api<void>(`/users/${id}`, { method: 'DELETE' }),
  orders: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Order>>(`/orders${q}`);
  },
  exportOrders: (params?: { branchId?: string; from?: string; to?: string }) => {
    const q = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))}`
      : '';
    return api<Record<string, unknown>[]>(`/reports/export/orders${q}`);
  },
  exportBookings: (params?: { branchId?: string; from?: string; to?: string }) => {
    const q = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))}`
      : '';
    return api<Record<string, unknown>[]>(`/reports/export/bookings${q}`);
  },
  exportInventory: (params?: { branchId?: string }) => {
    const q = params?.branchId ? `?branchId=${params.branchId}` : '';
    return api<Record<string, unknown>[]>(`/reports/export/inventory${q}`);
  },
  salesSummary: (period: 'daily' | 'weekly' | 'monthly' | 'yearly', branchId?: string) => {
    const params = new URLSearchParams({ period });
    if (branchId) params.set('branchId', branchId);
    return api<{
      period: 'daily' | 'weekly' | 'monthly' | 'yearly';
      label: string;
      from: string;
      to: string;
      branchId: number | null;
      totalSales: number;
      onlineSales: number;
      walkInSales: number;
      posSales: number;
      serviceSales: number;
      onlineOrders: number;
      walkInOrders: number;
      serviceInvoices: number;
      totalOrders: number;
    }>(`/reports/branch/summary?${params}`);
  },
  bookings: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return api<Paginated<Booking>>(`/bookings${q}`);
  },
  revenue: (days = 30) => api<{ date: string; revenue: number }[]>(`/reports/revenue?days=${days}`),
  inventorySummary: () =>
    api<{
      branches: {
        branchId: number;
        branchName: string;
        bikeModels: { name: string; quantity: number }[];
        totalBikeUnits: number;
        totalPartUnits: number;
      }[];
      grandTotalBikeUnits: number;
      grandTotalPartUnits: number;
    }>('/inventory/summary/all'),
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
  foundersSection: () => publicApi.founders(),
  updateFoundersSection: (data: {
    eyebrow: string;
    title: string;
    subtitle: string;
    founders: { name: string; title: string; vision: string; bio: string; image: string }[];
  }) =>
    api<typeof data>('/public/customization/founders', { method: 'PUT', body: JSON.stringify(data) }),
  uploadFounderImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiUpload<{ url: string }>('/public/upload-founder-image', form);
  },
  featuresSection: () => publicApi.features(),
  updateFeaturesSection: (data: {
    eyebrow: string;
    title: string;
    subtitle: string;
    features: { icon: string; title: string; desc: string; stat: string; statLabel: string }[];
  }) =>
    api<typeof data>('/public/customization/features', { method: 'PUT', body: JSON.stringify(data) }),
  footerContactSection: () => publicApi.footerContact(),
  updateFooterContactSection: (data: {
    email: string;
    phones: string[];
    address: string;
  }) =>
    api<typeof data>('/public/customization/footer-contact', { method: 'PUT', body: JSON.stringify(data) }),
  partsFulfillmentBranch: () => publicApi.partsFulfillmentBranch(),
  updatePartsFulfillmentBranch: (branchId: number | null) =>
    api<{ branchId: number | null }>('/public/customization/parts-fulfillment-branch', {
      method: 'PUT',
      body: JSON.stringify({ branchId }),
    }),
  aboutHeroSection: () => publicApi.aboutHero(),
  updateAboutHeroSection: (data: AboutHeroSection) =>
    api<AboutHeroSection>('/public/customization/about-hero', { method: 'PUT', body: JSON.stringify(data) }),
  homeHeroSection: () => publicApi.homeHero(),
  updateHomeHeroSection: (data: HomeHeroSection) =>
    api<HomeHeroSection>('/public/customization/home-hero', { method: 'PUT', body: JSON.stringify(data) }),
  termsSection: () => publicApi.terms(),
  updateTermsSection: (sections: LegalSection[]) =>
    api<LegalSection[]>('/public/customization/terms', { method: 'PUT', body: JSON.stringify(sections) }),
  privacySection: () => publicApi.privacy(),
  updatePrivacySection: (sections: LegalSection[]) =>
    api<LegalSection[]>('/public/customization/privacy', { method: 'PUT', body: JSON.stringify(sections) }),
  faqSection: () => publicApi.faq(),
  updateFaqSection: (items: FaqItem[]) =>
    api<FaqItem[]>('/public/customization/faq', { method: 'PUT', body: JSON.stringify(items) }),
  brands: () => publicApi.brands(),
  categories: () => publicApi.categories(),
  allBikeDocuments: (params?: { search?: string; status?: string; branchId?: string }) => {
    const q = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v));
    const qs = q.toString() ? `?${q}` : '';
    return api<Record<string, unknown>[]>(`/branches/admin/bike-documents${qs}`);
  },
  documentTypes: () => api<Record<string, unknown>[]>('/document-types'),
  createDocumentType: (name: string) => api<Record<string, unknown>>('/document-types', { method: 'POST', body: JSON.stringify({ name }) }),
  setDocumentTypeActive: (id: number, isActive: boolean) =>
    api<Record<string, unknown>>(`/document-types/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteDocumentType: (id: number) => api<void>(`/document-types/${id}`, { method: 'DELETE' }),
  bikeModels: () => api<{ id: number; name: string }[]>('/products/bike-models'),
  createBikeModel: (name: string) =>
    api<{ id: number; name: string }>('/products/bike-models', { method: 'POST', body: JSON.stringify({ name }) }),
  updateBikeModel: (id: number, name: string) =>
    api<{ id: number; name: string }>(`/products/bike-models/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteBikeModel: (id: number) => api<void>(`/products/bike-models/${id}`, { method: 'DELETE' }),
};

export const branchApi = {
  dashboard: (branchId: number) =>
    api<Record<string, unknown>>(`/branches/${branchId}/dashboard`),
  posStats: (branchId: number) =>
    api<{ todayVouchers: number; todayCustomers: number; todaySales: number }>(
      `/branches/${branchId}/pos-stats`,
    ),
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
      brand?: string | null;
      category?: string | null;
      model?: string | null;
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
      brand?: string | null;
      category?: string | null;
      model?: string | null;
    }[];
  }>(`/inventory/${branchId}/stock`),
  inventorySummary: (branchId: number) =>
    api<{
      branchId: number;
      bikeModels: { name: string; quantity: number }[];
      totalBikeUnits: number;
      totalPartUnits: number;
    }>(`/inventory/${branchId}/summary`),
  searchBranchCatalog: (branchId: number, q: string, limit = 10) =>
    api<
      {
        type: 'BIKE' | 'PART';
        source: 'PRODUCT' | 'SERVICE_PART';
        id: string | number;
        name: string;
        code: string;
        quantity: number;
        alertAt: number;
        isLowStock: boolean;
        isSelected: boolean;
        brand?: string | null;
        category?: string | null;
        model?: string | null;
      }[]
    >(`/inventory/${branchId}/catalog-search?q=${encodeURIComponent(q)}&limit=${limit}`),
  setStock: (branchId: number, partId: number, quantity: number) =>
    api<unknown>(`/inventory/${branchId}/${partId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  removePartFromBranch: (branchId: number, partId: number) =>
    api<void>(`/inventory/${branchId}/${partId}`, { method: 'DELETE' }),
  adjustStock: (branchId: number, data: { partId: number; quantityChange: number; reason: string; notes?: string }) =>
    api<unknown>(`/inventory/${branchId}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  lowStock: (branchId: number) => api<unknown[]>(`/inventory/${branchId}/low-stock`),
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
    model?: string | null;
    brand?: { name: string } | null;
    category?: { name: string } | null;
  }[]>(`/branches/${branchId}/sale-products`),
  nextDocumentNumbers: (branchId: number) =>
    api<{ sale: string; purchase: string; service: string }>(
      `/branches/${branchId}/next-document-numbers`,
    ),
  createSaleInvoice: (data: {
    branchId: number;
    customerId: number;
    items: { productId: string; quantity: number; unitPrice?: number; bikeChassisNumberId?: number }[];
    reference?: string;
    notes?: string;
    receivedAmount?: number;
    receivedAccountId?: number;
    invoiceDate?: string;
  }) => api<{ order: Order; voucher: unknown; receiptVoucher?: unknown }>('/orders/sale-invoice', {
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
  partOrders: () => api<Order[]>('/orders/part-orders'),
  approvePartOrder: (id: number) =>
    api<Order>(`/orders/${id}/approve-part-order`, { method: 'PATCH', body: '{}' }),
  deletePartOrder: (id: number) =>
    api<void>(`/orders/${id}/part-order`, { method: 'DELETE' }),
  approvePayment: (id: number, approved: boolean, biltyId?: string) =>
    api<Order>(`/orders/${id}/verify-payment`, {
      method: 'PATCH',
      body: JSON.stringify({ approved, biltyId }),
    }),
  setBiltyCharges: (orderId: number, biltyCharges: number, shippingProvider: string) =>
    api<Order>(`/orders/${orderId}/bilty-charges`, {
      method: 'PATCH',
      body: JSON.stringify({ biltyCharges, shippingProvider }),
    }),
  setBiltyTracking: (orderId: number, biltyId: string) =>
    api<Order>(`/orders/${orderId}/bilty-tracking`, {
      method: 'PATCH',
      body: JSON.stringify({ biltyId }),
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
  suppliers: (branchId: number, search?: string) => {
    const q = new URLSearchParams({ branchId: String(branchId), ...(search && { search }) });
    return api<Paginated<unknown>>(`/suppliers?${q}`);
  },
  createSupplier: (data: Record<string, unknown>) =>
    api<unknown>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Record<string, unknown>) =>
    api<unknown>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSupplier: (branchId: number, id: number) =>
    api<unknown>(`/suppliers/${id}`, { method: 'DELETE', body: JSON.stringify({ branchId }) }),
  purchaseProducts: (branchId: number) => api<{
    id: string;
    name: string;
    type: 'BIKE' | 'PART';
    model?: string | null;
    brand?: { name: string } | null;
    category?: { name: string } | null;
  }[]>(
    `/branches/${branchId}/purchase-products`,
  ),
  availableChassis: (branchId: number, productId: string) =>
    api<{
      id: number;
      chassisNumber: string;
      engineNumber?: string | null;
      motorNumber?: string | null;
      color?: string | null;
      isUsed?: boolean;
      condition?: string | null;
      meterReading?: number | null;
      comments?: string | null;
      status?: 'IN_STOCK' | 'RESERVED' | 'SOLD';
    }[]>(
      `/branches/${branchId}/chassis/available/${productId}`,
    ),
  colorOptions: () => api<{ id: number; name: string }[]>('/color-options'),
  createColorOption: (name: string) =>
    api<{ id: number; name: string }>('/color-options', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  validateChassisNumbers: (branchId: number, chassisNumbers: string[]) =>
    api<{ valid: boolean }>(`/branches/${branchId}/chassis/validate`, {
      method: 'POST',
      body: JSON.stringify({ chassisNumbers }),
    }),
  validateBikeUnits: (
    branchId: number,
    bikeUnits: { chassisNumber: string; engineNumber?: string; motorNumber?: string; color?: string }[],
  ) =>
    api<{ valid: boolean }>(`/branches/${branchId}/chassis/validate`, {
      method: 'POST',
      body: JSON.stringify({ bikeUnits }),
    }),
  listChassis: (branchId: number, params?: { productId?: string; status?: 'IN_STOCK' | 'RESERVED' | 'SOLD' }) => {
    const q = new URLSearchParams();
    if (params?.productId) q.set('productId', params.productId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return api<{
      id: number;
      chassisNumber: string;
      status: 'IN_STOCK' | 'RESERVED' | 'SOLD';
      product: { id: string; name: string; type: string };
      purchase: { id: number; documentRef: string | null; invoiceNumber: string | null; createdAt: string };
      saleOrder: { id: number; saleReference: string | null; trackingId: string | null; createdAt: string } | null;
      saleOrderItem?: { order: { id: number; saleReference: string | null; trackingId: string | null; createdAt: string } } | null;
    }[]>(`/branches/${branchId}/chassis${qs ? `?${qs}` : ''}`);
  },
  createPurchaseInvoice: (data: {
    branchId: number;
    supplierId: number;
    reference?: string;
    items: {
      productId: string;
      quantity: number;
      unitCost: number;
      bikeUnits?: { chassisNumber: string; engineNumber?: string; motorNumber?: string; color?: string }[];
    }[];
    notes?: string;
    invoiceDate?: string;
  }) => api<{ purchase: unknown; voucher: unknown }>('/purchases/invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  purchases: (branchId: number, params?: { limit?: string }) => {
    const q = new URLSearchParams({ branchId: String(branchId), ...(params?.limit ? { limit: params.limit } : {}) });
    return api<Paginated<unknown>>(`/purchases?${q}`);
  },
  purchase: (id: number) => api<unknown>(`/purchases/${id}`),
  purchaseInvoice: (id: number) => api<PurchaseInvoiceData>(`/purchases/${id}/invoice`),
  updatePurchaseInvoice: (
    id: number,
    data: {
      supplierId?: number;
      items?: {
        purchaseItemId?: number;
        chassisId?: number;
        unitCost?: number;
        color?: string | null;
        engineNumber?: string | null;
        motorNumber?: string | null;
        chassisNumber?: string;
      }[];
      removals?: {
        purchaseItemId?: number;
        chassisId?: number;
      }[];
    },
  ) => api<unknown>(`/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePurchaseInvoice: (id: number) =>
    api<void>(`/purchases/${id}`, { method: 'DELETE' }),
  updateOrderItems: (
    orderId: number,
    data: {
      items: {
        orderItemId: number;
        unitPrice?: number;
      }[];
    },
  ) => api<unknown>(`/orders/${orderId}/items`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSaleInvoice: (orderId: number) =>
    api<void>(`/orders/${orderId}`, { method: 'DELETE' }),
  createServiceInvoice: (data: {
    branchId: number;
    customerId: number;
    reference?: string;
    labourCost: number;
    items: { productId: string; quantity: number; unitPrice?: number }[];
    notes?: string;
    invoiceDate?: string;
  }) => api<{ invoice: unknown; voucher: unknown }>('/service-invoices/invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  serviceInvoices: (branchId: number, params?: { limit?: string }) => {
    const q = new URLSearchParams({ branchId: String(branchId), ...(params?.limit ? { limit: params.limit } : {}) });
    return api<Paginated<unknown>>(`/service-invoices?${q}`);
  },
  serviceInvoice: (id: number) => api<ServiceInvoiceData>(`/service-invoices/${id}/invoice`),
  deleteServiceInvoice: (id: number) =>
    api<void>(`/service-invoices/${id}`, { method: 'DELETE' }),
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
  updateVoucherAmount: (branchId: number, voucherId: number, amount: number) =>
    api<unknown>(`/accounting/${branchId}/vouchers/${voucherId}`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    }),
  banks: (branchId: number) => api<unknown[]>(`/accounting/${branchId}/banks`),
  createBank: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/banks`, { method: 'POST', body: JSON.stringify(data) }),
  updateBank: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/accounting/${branchId}/banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  trialBalance: (branchId: number) => api<unknown>(`/accounting/${branchId}/trial-balance`),
  ledger: (branchId: number, accountId: number, params?: { fromDate?: string; toDate?: string; financialYearId?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<unknown>(`/accounting/${branchId}/ledger/${accountId}${q}`);
  },
  financialYears: (branchId: number) =>
    api<
      {
        id: number;
        label: string;
        startDate: string;
        endDate: string | null;
        status: 'ACTIVE' | 'CLOSED';
        closedAt: string | null;
      }[]
    >(`/accounting/${branchId}/financial-years`),
  closeFinancialYear: (branchId: number) =>
    api<{ closedYear: { label: string }; newYear: { label: string } }>(
      `/accounting/${branchId}/financial-year/close`,
      { method: 'POST' },
    ),
  branchSuppliers: (branchId: number, params?: { limit?: string; page?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<Paginated<unknown>>(`/accounting/${branchId}/suppliers${q}`);
  },
  branchCustomers: (branchId: number, params?: { limit?: string; page?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<Paginated<unknown>>(`/accounting/${branchId}/customers${q}`);
  },
  walkInCustomers: (branchId: number, params?: { limit?: string; page?: string; search?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<Paginated<unknown>>(`/walk-in/${branchId}/customers${q}`);
  },
  createWalkInCustomer: (branchId: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers`, { method: 'POST', body: JSON.stringify(data) }),
  updateWalkInCustomer: (branchId: number, id: number, data: Record<string, unknown>) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWalkInCustomer: (branchId: number, id: number) =>
    api<unknown>(`/walk-in/${branchId}/customers/${id}`, { method: 'DELETE' }),
  parts: () => adminApi.parts(),
  salesSummary: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') =>
    api<{
      period: 'daily' | 'weekly' | 'monthly' | 'yearly';
      label: string;
      from: string;
      to: string;
      totalSales: number;
      onlineSales: number;
      walkInSales: number;
      posSales: number;
      serviceSales: number;
      onlineOrders: number;
      walkInOrders: number;
      serviceInvoices: number;
      totalOrders: number;
    }>(`/reports/branch/summary?period=${period}`),
  exportOrders: (params?: { from?: string; to?: string }) => {
    const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : '';
    return api<Record<string, unknown>[]>(`/reports/export/orders${q}`);
  },
  exportInventory: () => api<Record<string, unknown>[]>('/reports/export/inventory'),
  profitLossReport: (branchId: number, params: { type: 'sale' | 'service'; from?: string; to?: string }) =>
    api<unknown>(`/reports/profit-loss/${branchId}?${new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    )}`),
  bikeDocuments: (branchId: number, params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v));
    const qs = q.toString() ? `?${q}` : '';
    return api<Record<string, unknown>[]>(`/branches/${branchId}/bike-documents${qs}`);
  },
  bikeDocumentChecklist: (branchId: number, chassisId: number) =>
    api<Record<string, unknown>>(`/branches/${branchId}/bike-documents/${chassisId}`),
  updateBikeDocument: (branchId: number, chassisId: number, documentId: number, data: Record<string, unknown>) =>
    api<Record<string, unknown>>(`/branches/${branchId}/bike-documents/${chassisId}/${documentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
