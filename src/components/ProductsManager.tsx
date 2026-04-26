import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus, Trash2, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useEscKey from '../hooks/useEscKey';
import ConfirmModal from './ConfirmModal';

const ProductsManager: React.FC = () => {
  const { isTI, permissions } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEscKey(() => setIsModalOpen(false), isModalOpen);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    price: 0,
    stock: 0
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
    });
    return () => unsub();
  }, []);

  // --- NUEVA FUNCIÓN PARA ACTUALIZAR STOCK ---
  const handleUpdateStock = async (id: string, currentStock: number, change: number) => {
    const newStock = currentStock + change;
    if (newStock < 0) return; // Evita stock negativo

    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, { stock: newStock });
      showToast('Stock actualizado');
    } catch (error) {
      console.error("Error actualizando stock:", error);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || newProduct.price <= 0) return;
    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock)
      });
      setNewProduct({ name: '', category: '', price: 0, stock: 0 });
      setIsModalOpen(false);
      showToast();
    } catch (error) {
      console.error("Error al añadir producto:", error);
    }
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);

  const confirmDeleteProduct = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await deleteDoc(doc(db, 'products', id));
    showToast('Producto eliminado');
  };

  return (
    <div className="space-y-6">
      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar este producto? Esta acción no se puede deshacer."
          onConfirm={confirmDeleteProduct}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
          <p className="text-slate-500 text-sm">Control de insumos</p>
        </div>
        {(isTI || permissions.products.add) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 shadow-md"
          >
            <Plus size={20} /> Nuevo Producto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative">
            {(isTI || permissions.products.delete) && (
              <button onClick={() => handleDelete(product.id)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors">
                <Trash2 size={18} />
              </button>
            )}
            <div className="bg-emerald-50 w-fit p-3 rounded-xl text-emerald-600 mb-4">
              <Package size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800">{product.name}</h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">{product.category}</span>
            
            <div className="mt-6 flex justify-between items-end">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Precio</p>
                <p className="text-xl font-black text-slate-800">S/ {product.price}</p>
              </div>

              {/* --- CONTROLADOR DE STOCK MEJORADO --- */}
              <div className="flex flex-col items-end gap-2">
                <p className="text-slate-400 text-xs uppercase font-bold text-right">Stock</p>
                <div className={`flex items-center gap-3 p-1 rounded-xl border ${product.stock < 5 ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
                  {(isTI || permissions.products.edit) && (
                    <button 
                      onClick={() => handleUpdateStock(product.id, product.stock, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm hover:text-rose-500 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                  )}
                  
                  <div className={`flex items-center gap-1 font-bold ${product.stock < 5 ? 'text-rose-500' : 'text-slate-700'}`}>
                    {product.stock < 5 && <AlertTriangle size={14} />}
                    <span className="min-w-[20px] text-center">{product.stock}</span>
                  </div>

                  {(isTI || permissions.products.edit) && (
                    <button 
                      onClick={() => handleUpdateStock(product.id, product.stock, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm hover:text-emerald-600 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-slate-800">Añadir Insumo</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <input placeholder="Nombre" className="w-full p-3 rounded-xl border border-slate-200 outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input placeholder="Categoría" className="w-full p-3 rounded-xl border border-slate-200 outline-none" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Precio" className="w-full p-3 rounded-xl border border-slate-200 outline-none" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                <input type="number" placeholder="Stock" className="w-full p-3 rounded-xl border border-slate-200 outline-none" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsManager;