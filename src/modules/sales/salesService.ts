import {
  collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, where, orderBy, Unsubscribe,
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

/**
 * Escucha las ventas de un mes concreto (YYYY-MM).
 * Filtra en Firestore — solo descarga los documentos del mes visible,
 * no toda la colección histórica.
 */
export function subscribeToSalesByMonth(
  monthKey: string,
  onData: (sales: Sale[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'sales'),
      where('date', '>=', `${monthKey}-01`),
      where('date', '<=', `${monthKey}-31`),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
    ),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale)),
    onError,
  );
}

/** Total vendido en un mes (lectura única — para la comparación mensual). */
export async function fetchMonthTotal(monthKey: string): Promise<number> {
  const snap = await getDocs(query(
    collection(db, 'sales'),
    where('date', '>=', `${monthKey}-01`),
    where('date', '<=', `${monthKey}-31`),
  ));
  return snap.docs.reduce((sum, d) => sum + ((d.data() as Sale).total ?? 0), 0);
}

/**
 * Escucha las ventas tipo pack (con rango de vigencia).
 * Filtro de igualdad único — no requiere índice compuesto.
 * La vigencia (validFrom ≤ hoy ≤ validTo) se filtra en el cliente.
 */
export function subscribeToPacks(
  onData: (sales: Sale[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'sales'), where('validOnlyToday', '==', false)),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale)),
    onError,
  );
}

/** Obtiene los precios de servicios (lectura única). */
export async function fetchServicePrices(): Promise<Record<string, number>> {
  const snap = await getDoc(doc(db, 'servicePrices', 'default'));
  return snap.exists() ? (snap.data() as Record<string, number>) : {};
}

/**
 * Guarda los precios de servicios.
 * merge: true — conserva precios de tratamientos antiguos que ya no estén
 * en el catálogo visible (sesiones legadas aún pueden referenciarlos).
 */
export async function saveServicePrices(prices: Record<string, number>): Promise<void> {
  await setDoc(doc(db, 'servicePrices', 'default'), prices, { merge: true });
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
