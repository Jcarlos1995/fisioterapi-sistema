import {
  collection, addDoc, doc, getDoc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface Sale {
  id: string;
  type: 'service' | 'product';
  patientId: string;
  patientName: string;
  itemName: string;
  itemId?: string;
  unitPrice: number;
  qty: number;
  total: number;
  date: string;
  sessionId?: string;
  validOnlyToday: boolean;
  validFrom?: string;
  validTo?: string;
  notes?: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

export interface SalePayload {
  type: 'service' | 'product';
  patientId: string;
  patientName: string;
  itemName: string;
  itemId?: string;
  unitPrice: number;
  qty: number;
  total: number;
  date: string;
  validOnlyToday: boolean;
  validFrom?: string;
  validTo?: string;
  notes: string;
}

export interface SaleProduct {
  id: string;
  name: string;
  category?: string;
  price?: number;
}

/** Escucha ventas ordenadas por fecha. */
export function subscribeToSales(
  onData: (sales: Sale[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'sales'), orderBy('date', 'desc'), orderBy('createdAt', 'desc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale)),
    onError,
  );
}

/** Obtiene los precios de servicios (lectura única). */
export async function fetchServicePrices(): Promise<Record<string, number>> {
  const snap = await getDoc(doc(db, 'servicePrices', 'default'));
  return snap.exists() ? (snap.data() as Record<string, number>) : {};
}

/** Guarda los precios de servicios. */
export async function saveServicePrices(prices: Record<string, number>): Promise<void> {
  await setDoc(doc(db, 'servicePrices', 'default'), prices);
}

/** Elimina una venta. */
export async function deleteSale(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sales', id));
}

/** Crea una venta manual. */
export async function createSale(
  payload: SalePayload,
  createdByUid: string,
  createdByName: string,
): Promise<void> {
  await addDoc(collection(db, 'sales'), {
    ...payload,
    createdAt: new Date().toISOString(),
    createdByUid,
    createdByName,
  });
}
