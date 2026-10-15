import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

async function run() {
  const rawConfig = fs.readFileSync('./firebase-applet-config.json', 'utf-8');
  const firebaseConfig = JSON.parse(rawConfig);

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || '(default)');

  console.log("Fetching employees list...");
  const snap = await getDocs(collection(db, 'employees'));
  
  if (snap.empty) {
    console.log("No employees found.");
  } else {
    snap.forEach(doc => {
      console.log(`ID: ${doc.id} | Data:`, doc.data());
    });
  }
}

run().catch(console.error);
