import {
  collection, addDoc, doc, getDoc, getDocs, setDoc,
  onSnapshot, query, where, orderBy, runTransaction, Unsubscribe,
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

/** Ventas de un paciente (lectura única — para el expediente). */
export async function fetchSalesByPatient(patientId: string): Promise<Sale[]> {
  const snap = await getDocs(
    query(collection(db, 'sales'), where('patientId', '==', patientId)),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale);
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

/**
 * Elimina una venta. Si era una venta de producto, restaura el stock
 * descontado — todo en una transacción atómica.
 */
export async function deleteSale(id: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const saleRef  = doc(db, 'sales', id);
    const saleSnap = await tx.get(saleRef);

    if (saleSnap.exists()) {
      const sale = saleSnap.data() as Sale;
      if (sale.type === 'product' && sale.itemId) {
        const prodRef  = doc(db, 'products', sale.itemId);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists()) {
          const current = Number(prodSnap.data().stock) || 0;
          tx.update(prodRef, { stock: current + (sale.qty || 1) });
        }
      }
    }
    tx.delete(saleRef);
  });
}

/**
 * Crea una venta manual. Si es una venta de producto, descuenta el stock
 * del inventario en la misma transacción (atómico: venta y descuento se
 * escriben juntos o no se escribe nada). El stock nunca baja de 0.
 */
export async function createSale(
  payload: SalePayload,
  createdByUid: string,
  createdByName: string,
): Promise<void> {
  const saleData = {
    ...payload,
    createdAt: new Date().toISOString(),
    createdByUid,
    createdByName,
  };

  if (payload.type === 'product' && payload.itemId) {
    await runTransaction(db, async (tx) => {
      const prodRef  = doc(db, 'products', payload.itemId!);
      const prodSnap = await tx.get(prodRef);
      const saleRef  = doc(collection(db, 'sales'));

      tx.set(saleRef, saleData);
      if (prodSnap.exists()) {
        const current = Number(prodSnap.data().stock) || 0;
        tx.update(prodRef, { stock: Math.max(0, current - payload.qty) });
      }
    });
    return;
  }

  await addDoc(collection(db, 'sales'), saleData);
}
