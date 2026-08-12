// Servicio del catálogo de ítems vendibles (servicios e instrumentos que la
// admin agrega desde el gestor de precios). Los 5 servicios base y los 10
// instrumentos base viven en código (constants.tsx); esta colección guarda
// solo los ítems adicionales que se registran desde la app.
import {
  collection, addDoc, doc, deleteDoc, onSnapshot, query, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type CatalogKind = 'service' | 'instrument';

export interface CatalogItem {
  id: string;
  name: string;
  kind: CatalogKind;
  createdAt: string;
}

/** Escucha en tiempo real los ítems del catálogo. */
export function subscribeToCatalogItems(
  onData: (items: CatalogItem[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'catalogItems')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CatalogItem)),
    onError,
  );
}

/** Agrega un servicio o instrumento nuevo al catálogo. */
export async function addCatalogItem(name: string, kind: CatalogKind): Promise<void> {
  await addDoc(collection(db, 'catalogItems'), {
    name: name.trim(),
    kind,
    createdAt: new Date().toISOString(),
  });
}

/** Elimina un ítem del catálogo (no borra su precio guardado en servicePrices). */
export async function deleteCatalogItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'catalogItems', id));
}
