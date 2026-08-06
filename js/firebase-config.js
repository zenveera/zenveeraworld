/* ============================================================
   FIREBASE CONFIG — paste the keys from YOUR Firebase project here.
   See README.md "Step 1" for exactly how to get these values.
   This is safe to be public — it is not a secret password.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCMELwlRovc-7wNQ7hxGVQU4LDGYNiRJHs",
  authDomain: "zenveera-world.firebaseapp.com",
  projectId: "zenveera-world",
  storageBucket: "zenveera-world.firebasestorage.app",
  messagingSenderId: "741590423442",
  appId: "1:741590423442:web:0bc820ff4b41f7980b534b",
  measurementId: "G-34QQD8PE59",
};

// Initialize Firebase (uses the compat SDK loaded via <script> tags in the HTML files)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* ------------------------------------------------------------
   FIRESTORE SECURITY RULES
   These can't be set from this file — they live on Firebase's
   servers, not in your website's code. Copy the contents of
   firestore.rules (shipped alongside this file) into:
   Firebase Console → Firestore Database → Rules → publish.
   Without this, the app hits "Missing or insufficient
   permissions" errors on cart/order reads and writes.
   ------------------------------------------------------------ */
