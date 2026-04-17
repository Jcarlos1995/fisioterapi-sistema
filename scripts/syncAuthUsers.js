/**
 * Sincroniza todos los usuarios de Firebase Auth con la colección userRoles.
 * Los que ya tienen documento no se tocan; solo se crean los que faltan.
 *
 * Uso:
 *   node scripts/syncAuthUsers.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID;
const EXPORT_FILE = path.resolve(__dirname, '../.auth_export_tmp.json');

async function main() {
  // 1. Exportar todos los usuarios de Firebase Auth via CLI
  console.log('Exportando usuarios de Firebase Auth...');
  execSync(`firebase auth:export "${EXPORT_FILE}" --format=json --project ${PROJECT_ID}`, { stdio: 'inherit' });

  const { users } = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
  fs.unlinkSync(EXPORT_FILE);

  console.log(`\nEncontrados ${users.length} usuarios en Firebase Auth.\n`);

  // 2. Conectar a Firestore
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  let created = 0;
  let skipped = 0;

  for (const u of users) {
    const ref     = doc(db, 'userRoles', u.localId);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      // Si ya tiene doc pero le falta el email, lo actualizamos
      if (!existing.data().email && u.email) {
        await setDoc(ref, { email: u.email }, { merge: true });
        console.log(`  ✏️  Email añadido a: ${u.email}`);
      } else {
        console.log(`  ⏭️  Ya existe: ${u.email}`);
      }
      skipped++;
    } else {
      await setDoc(ref, {
        email:     u.email ?? '',
        role:      null,
        active:    true,
        createdAt: new Date().toISOString(),
      });
      console.log(`  ✅ Creado: ${u.email}`);
      created++;
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`  Creados  : ${created}`);
  console.log(`  Existían : ${skipped}`);
  console.log(`  Total    : ${users.length}`);
  console.log(`────────────────────────────────`);
  console.log('Sincronización completa.\n');

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
