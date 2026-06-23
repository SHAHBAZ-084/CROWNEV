import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { getLoginUrl } from '../../lib/authRedirect';
import { formatPKR } from '../../lib/format';
import { Button } from '../ui/Button';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, total, count, updateQty, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleCheckout() {
    onClose();
    if (!user) {
      navigate(getLoginUrl('/checkout'));
      return;
    }
    navigate('/checkout');
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand" />
                <h2 className="font-display text-lg font-semibold text-brand">Cart ({count})</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-surface-alt">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <p className="text-center text-text-muted py-12">Your cart is empty</p>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={`${item.productId}-${item.color}`} className="flex gap-4 rounded-xl border border-border p-3">
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-surface-alt overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-text-muted">EV</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brand truncate">{item.name}</p>
                        <p className="text-sm text-brand-light">{formatPKR(item.price)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)} className="rounded-lg border p-1">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm tabular-nums w-6 text-center">{item.quantity}</span>
                          <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)} className="rounded-lg border p-1">
                            <Plus className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => removeItem(item.productId)} className="ml-auto text-warning">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-border p-6 space-y-4">
                <div className="flex justify-between font-display text-lg font-semibold text-brand">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPKR(total)}</span>
                </div>
                <Button variant="accent" className="w-full" size="lg" onClick={handleCheckout}>
                  Proceed to Checkout
                </Button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
