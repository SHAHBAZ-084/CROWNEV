import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  color?: string;
  imageUrl?: string;
}

interface CartContextValue {
  items: CartItem[];
  branchId: number | null;
  setBranchId: (id: number) => void;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [branchId, setBranchIdState] = useState<number | null>(null);

  const setBranchId = useCallback((id: number) => setBranchIdState(id), []);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId && i.color === item.color);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && i.color === item.color
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQty = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, branchId, setBranchId, addItem, removeItem, updateQty, clearCart, total, count }),
    [items, branchId, setBranchId, addItem, removeItem, updateQty, clearCart, total, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
