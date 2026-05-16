import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Minus, Package, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { functions } from '../../lib/firebase';
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

// Color de fondo del ícono según categoría
const CATEGORY_COLOR: Record<string, string> = {
  colageno:  'bg-purple-100 text-purple-600',
  capsulas:  'bg-emerald-100 text-emerald-600',
  polvo:     'bg-amber-100 text-amber-600',
  crema:     'bg-pink-100 text-pink-600',
  jarabe:    'bg-cyan-100 text-cyan-600',
  tabletas:  'bg-blue-100 text-blue-600',
};

function categoryColor(cat?: string): string {
  const key = (cat || '').toLowerCase().trim();
  return CATEGORY_COLOR[key] ?? 'bg-slate-100 text-slate-500';
}

interface PatientProductsListProps {
  patient: PortalPatient;
}

const PatientProductsList: React.FC<PatientProductsListProps> = ({ patient }) => {
  const { showToast } = useToast();
  const [products, setProducts]   = useState<PortalProduct[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [cart, setCart]           = useState<Record<string, CartItem>>({});
  const [sending, setSending]     = useState(false);

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  const addToCart = (product: PortalProduct) =>
    setCart(prev => ({ ...prev, [product.id]: { product, qty: 1 } }));

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => {
      const item = prev[productId];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...item, qty: Math.min(newQty, item.product.stock ?? 99) } };
    });
  };

  const removeFromCart = (productId: string) =>
    setCart(prev => { const n = { ...prev }; delete n[productId]; return n; });

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((s, i) => s + (i.product.price || 0) * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const handleConfirm = async () => {
    if (!cartItems.length || sending) return;
    setSending(true);
    try {
      await reserveProductsCallable({
        items: cartItems.map(({ product, qty }) => ({
          productId: product.id,
          name:  product.name,
          qty,
          price: product.price || 0,
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

  if (loading) return (
    <div className="py-10 text-center text-slate-400 text-sm">Cargando productos...</div>
  );
  if (error) return (
    <div className="py-10 text-center text-rose-500 text-sm">{error}</div>
  );

  return (
    <div className={cartItems.length > 0 ? 'pb-28' : ''}>

      {/* Aviso */}
      <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
        <Package size={13} />
        Usa "Separar" para reservar. La clínica confirmará la disponibilidad.
      </p>

      {products.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
          No hay productos disponibles por ahora.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map(product => {
            const inCart   = Boolean(cart[product.id]);
            const cartItem = cart[product.id];
            const hasStock = (product.stock ?? 0) > 0;
            const iconClass = categoryColor(product.category);

            return (
              <article
                key={product.id}
                className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-all ${
                  inCart ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'
                }`}
              >
                {/* Ícono + categoría */}
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                    <Package size={16} />
                  </div>
                  <span className="text-xs text-slate-400 capitalize truncate">{product.category || 'Producto'}</span>
                </div>

                {/* Nombre */}
                <h3 className="font-semibold text-slate-800 text-sm leading-snug capitalize flex-1">
                  {product.name}
                </h3>

                {/* Precio + stock */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-blue-700">
                    S/ {(product.price || 0).toFixed(2)}
                  </p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    hasStock ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-500'
                  }`}>
                    {hasStock ? `${product.stock} disp.` : 'Sin stock'}
                  </span>
                </div>

                {/* Acción */}
                {!inCart ? (
                  <button
                    type="button"
                    disabled={!hasStock}
                    onClick={() => addToCart(product)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      hasStock
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart size={14} />
                    Separar
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-1 bg-blue-50 rounded-xl px-2 py-1">
                    <button
                      type="button"
                      onClick={() => updateQty(product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">{cartItem.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(product.id, 1)}
                      disabled={cartItem.qty >= (product.stock ?? 99)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-sm disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Barra de carrito sticky */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-xl">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setCart({})}
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                aria-label="Vaciar carrito"
              >
                <Trash2 size={15} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">
                  {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
                </p>
                <p className="text-xs text-slate-500">Total: S/ {cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={sending}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60 shadow-sm shadow-blue-300"
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
