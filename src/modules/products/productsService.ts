// Servicio de productos/inventario — toda la lógica de Firestore en un solo lugar.
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types';

/** Escucha en tiempo real la colección de productos. */
export function subscribeToProducts(
  onData:  (products: Product[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'products'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product)),
    onError,
  );
}

/** Crea un producto nuevo. */
export async function createProduct(
  data: Omit<Product, 'id'>,
): Promise<void> {
  await addDoc(collection(db, 'products'), {
    ...data,
    price: Number(data.price),
    stock: Number(data.stock),
  });
}

/** Actualiza el stock de un producto sumando `delta` (positivo o negativo). */
export async function adjustStock(id: string, currentStock: number, delta: number): Promise<void> {
  const newStock = currentStock + delta;
  if (newStock < 0) return; // Evita stock negativo
  await updateDoc(doc(db, 'products', id), { stock: newStock });
}

/** Elimina un producto. */
export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}
