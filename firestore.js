/* Shared Vaibhav Enterprises Firestore connection.
   Reads the existing full app document; writes only H.Expenses fields. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBaaV8A69XqckjnVuMCy6F5GyEuqRJvt_Y",
  authDomain: "vaibhav-enterprises-ee336.firebaseapp.com",
  projectId: "vaibhav-enterprises-ee336",
  storageBucket: "vaibhav-enterprises-ee336.firebasestorage.app",
  messagingSenderId: "172689572436",
  appId: "1:172689572436:web:5a68b14a5fea0eb44fa3c1",
  measurementId: "G-V4MFRFH744"
};

let db, dataRef, connected = false, connecting = false;
function status(message, state='info') {
  const el = document.getElementById('he-firestore-status');
  if (el) { el.textContent = message; el.dataset.state = state; }
}

async function connectAndLoad() {
  if (connecting) return;
  connecting = true;
  status('Firestore शी जोडत आहे...', 'loading');
  try {
    if (!db) {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      dataRef = doc(db, 'apps', 'vaibhav_enterprises_data');
    }
    const snap = await getDoc(dataRef);
    if (!snap.exists()) throw new Error('apps/vaibhav_enterprises_data document सापडले नाही.');
    const remote = snap.data() || {};
    if (typeof window.applyHExpensesRemoteData !== 'function') throw new Error('App JavaScript load झाले नाही.');
    window.applyHExpensesRemoteData(remote);
    connected = true;
    window.__heFirebaseConnected = true;
    status(`Firestore Connected • Payments: ${(remote.payments||[]).length} • Paid Payments: ${(remote.paidPayments||[]).length}`, 'success');
  } catch (err) {
    console.error('H.Expenses Firestore error:', err);
    connected = false;
    window.__heFirebaseConnected = false;
    status('Firestore Error: ' + (err.message || 'Connection failed'), 'error');
  } finally { connecting = false; }
}

window.saveHExpensesToFirestore = async function() {
  if (!db || !dataRef) throw new Error('Firestore अजून initialize झालेले नाही.');
  const payload = window.getHExpensesFirestorePayload();
  // merge:true preserves every other Vaibhav Enterprises field.
  await setDoc(dataRef, payload, { merge: true });
  connected = true;
};
window.retryHExpensesFirestore = connectAndLoad;
window.addEventListener('DOMContentLoaded', connectAndLoad);
