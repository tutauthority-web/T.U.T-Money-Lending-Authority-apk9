import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import * as fs from 'fs';

async function run() {
  const rawConfig = fs.readFileSync('./firebase-applet-config.json', 'utf-8');
  const firebaseConfig = JSON.parse(rawConfig);

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || '(default)');

  console.log("Fetching latest email logs from database...");
  const q = query(collection(db, 'email_logs'), orderBy('timestamp', 'desc'), limit(15));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log("No email logs found.");
  } else {
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`[${doc.id}] To: ${data.to} | Subject: ${data.subject} | Status: ${data.status} | Error: ${data.error || 'None'}`);
    });
  }
}

run().catch(console.error);
