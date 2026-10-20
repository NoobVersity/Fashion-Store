import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'threads_cart_v1';
const CartContext = createContext(null);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const lineKey = (item) => `${item.productId}|${item.size}|${item.color}`;

/**
 * Cart lives in browser state + localStorage (per the MVP spec). The
 * server revalidates prices, stock and discounts at checkout, so this
 * is only a convenience cache.
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full/blocked — cart simply won't persist */
    }
  }, [items]);

  const addItem = useCallback((product, { size, color, quantity = 1 }) => {
    setItems((prev) => {
      const key = `${product.id}|${size}|${color}`;
      const existing = prev.find((i) => lineKey(i) === key);
      const maxStock = product.maxStock ?? Number.MAX_SAFE_INTEGER;
      if (existing) {
        return prev.map((i) =>
          lineKey(i) === key
            ? { ...i, quantity: Math.min(i.quantity + quantity, maxStock) }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image_path: product.image_path,
          category_name: product.category_name || '',
          size,
          color,
          quantity: Math.min(quantity, maxStock),
          maxStock,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    setItems((prev) =>
      prev
        .map((i) =>
          lineKey(i) === key
            ? {
                ...i,
                quantity: Math.max(
                  0,
                  Math.min(quantity, i.maxStock ?? Number.MAX_SAFE_INTEGER)
                ),
              }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => lineKey(i) !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      items,
      count,
      subtotal,
      lineKey,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
