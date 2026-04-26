import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Minus, Package, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { functions } from '../../firebaseConfig';
import { useToast } from '../../context/ToastContext';
import { PortalPatient } from './types';

interface PortalProduct {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock?: number;
}

interface CartItem {
  product: PortalProduct;
  qty: number;
}

interface ReserveProductsRequest {
  items: { productId: string; name: string; qty: number; price: number }[];
  patientName: string;
  patientDni: string;
  patientPhone: string;
}

interface GetPatientProductsResponse {
  products: PortalProduct[];
}

const getPatientProductsCallable = httpsCallable<void, GetPatientProductsResponse>(
  functions,
  'getPatientProducts'
);

const reserveProductsCallable = httpsCallable<ReserveProductsRequest, { success: boolean }>(
  functions,
  'reserveProducts'
);

interface PatientProductsListProps {
  patient: PortalPatient;
}

const PatientProductsList: React.FC<PatientProductsListProps> = ({ patient }) => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPatientProductsCallable();
        setProducts(result.data.products || []);
      } catch {
        setError('No pudimos cargar los productos en este momento.');
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const addToCart = (product: PortalProduct) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: { product, qty: 1 },
    }));
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const item = prev[productId];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      const maxQty = item.product.stock ?? 99;
      return { ...prev, [productId]: { ...item, qty: Math.min(newQty, maxQty) } };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (item.product.price || 0) * item.qty,
    0
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  const handleConfirm = async () => {
    if (!cartItems.length || sending) return;
    setSending(true);
    try {
      await reserveProductsCallable({
        items: cartItems.map(({ product, qty }) => ({
          productId: product.id,
          name:      product.name,
          qty,
          price:     product.price || 0,
        })),
        patientName:  patient.name  || '',
        patientDni:   patient.dni   || '',
        patientPhone: patient.phone || '',
      });
      showToast('¡Separado enviado! La clínica se pondrá en contacto contigo.', 'success');
      setCart({});
    } catch {
      showToast('No pudimos enviar el separado. Inténtalo de nuevo.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Cargando productos...</p>;
  if (error)   return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className={cartItems.length > 0 ? 'pb-28' : ''}>
      <div className="grid grid-cols-3 gap-3">
        {products.length === 0 ? (
          <div className="col-span-3 bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-500">
            No hay productos disponibles por ahora.
          </div>
        ) : (
          products.map((product) => {
            const inCart   = Boolean(cart[product.id]);
            const cartItem = cart[product.id];
            const hasStock = (product.stock ?? 0) > 0;

            return (
              <article
                key={product.id}
                className={`bg-white border rounded-2xl p-3 shadow-sm transition-colors flex flex-col justify-between gap-3 ${
                  inCart ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'
                }`}
              >
                <div>
                  <h3 className="font-semibold text-slate-800 leading-tight text-sm">{product.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{product.category || 'Sin categoría'}</p>
                  <p className="text-sm font-bold text-blue-700 mt-2">S/ {(product.price || 0).toFixed(2)}</p>
                  <p className={`text-xs mt-0.5 ${hasStock ? 'text-slate-400' : 'text-rose-500 font-semibold'}`}>
                    {hasStock ? `Stock: ${product.stock}` : 'Sin stock'}
                  </p>
                </div>

                <div className="flex items-center justify-center">
                  {!inCart ? (
                    <button
                      type="button"
                      disabled={!hasStock}
                      onClick={() => addToCart(product)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        hasStock
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart size={13} />
                      Separar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 w-full justify-between">
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-bold text-slate-800">{cartItem.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, 1)}
                        disabled={cartItem.qty >= (product.stock ?? 99)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="w-7 h-7 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center justify-center transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}

        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Package size={13} />
          Usa el botón "Separar" para reservar productos. La clínica confirmará la disponibilidad.
        </p>
      </div>

      {/* Panel de carrito sticky */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setCart({})}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                aria-label="Vaciar carrito"
              >
                <Trash2 size={16} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
                </p>
                <p className="text-xs text-slate-500">Total: S/ {cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={sending}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={15} />
              {sending ? 'Enviando...' : 'Confirmar separado'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProductsList;
