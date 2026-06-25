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
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="font-display text-lg font-semibold text-slate-900">Cart ({count})</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white border border-slate-200">
                    <ShoppingCart className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-900">Your cart is empty</p>
                  <p className="mt-1 text-sm text-slate-500">Add items from the shop to get started</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={`${item.productId}-${item.color}`}
                      className="flex gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">EV</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.name}</p>
                        {item.color && <p className="text-xs text-slate-500">{item.color}</p>}
                        <p className="text-sm font-medium text-orange-500">{formatPKR(item.price)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, item.quantity - 1)}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-1 transition-colors hover:bg-white"
                          >
                            <Minus className="h-3 w-3 text-slate-600" />
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums text-slate-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, item.quantity + 1)}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-1 transition-colors hover:bg-white"
                          >
                            <Plus className="h-3 w-3 text-slate-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="ml-auto rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
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
              <div className="space-y-4 border-t border-slate-200 bg-white px-6 py-5">
                <div className="flex justify-between font-display text-lg font-semibold text-slate-900">
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
