/**
 * Migra el documento servicePrices/default al nuevo modelo de catálogo:
 *   - Agrega los 5 servicios base (reservas/sesiones) con su precio.
 *   - Conserva los precios antiguos de tratamientos que tengan precio > 0.
 *   - Descarta las claves antiguas con precio 0 (nunca se usaron).
 *
 * Requisitos:
 *   1. Clave del Admin SDK en: scripts/serviceAccount.json (está en .gitignore)
 *   2. firebase-admin instalado:  npm i firebase-admin --no-save
 *
 * Uso:
 *   node scripts/setServicePrices.cjs          → dry-run (muestra qué haría)
 *   node scripts/setServicePrices.cjs --write  → escribe el documento
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ── Precios de los 5 servicios base ──────────────────────────────────────────
// Sembrados a partir de los precios antiguos (rango S/ 30-60, mediana 50).
// La admin puede ajustarlos cuando quiera en Área Reservada → Precios.
const BASE_PRICES = {
  'Fisioterapia':                   50,
  'Quiropraxia':                    50,
  'Rehabilitación Post-Operatoria': 50,
  'Masaje Terapéutico':             50,
  'Terapia Deportiva':              50,
};
// ─────────────────────────────────────────────────────────────────────────────

const serviceAccount = require(path.resolve(__dirname, 'serviceAccount.json'));

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const REF = db.doc('servicePrices/default');
const WRITE = process.argv.includes('--write');

async function main() {
  // 1. Leer el documento actual
  const snap = await REF.get();
  const current = snap.exists ? snap.data() : {};

  console.log('\n── Documento actual (servicePrices/default) ──');
  console.log(JSON.stringify(current, null, 2));

  // 2. Construir el nuevo contenido: antiguos con precio > 0 + los 5 base
  const legacy = Object.fromEntries(
    Object.entries(current).filter(([name, price]) =>
      typeof price === 'number' && price > 0 && !(name in BASE_PRICES)
    )
  );
  const next = { ...legacy, ...BASE_PRICES };

  console.log('\n── Nuevo contenido propuesto ──');
  console.log(JSON.stringify(next, null, 2));

  const dropped = Object.keys(current).filter(k => !(k in next));
  if (dropped.length > 0) {
    console.log('\n── Claves descartadas (precio 0, nunca usadas) ──');
    dropped.forEach(k => console.log(`   · ${k}`));
  }

  if (!WRITE) {
    console.log('\nDry-run: no se escribió nada.');
    console.log('Ejecuta con --write para reemplazar el documento.\n');
    process.exit(0);
  }

  // 3. Reemplazar el documento completo
  await REF.set(next);
  console.log('\n✅ Documento reemplazado correctamente.');

  const after = await REF.get();
  console.log('\n── Verificación (contenido final) ──');
  console.log(JSON.stringify(after.data(), null, 2));
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
