// Firebase SDK via ESM CDN — pronto para site estático
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, setPersistence, browserSessionPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, addDoc, collection, serverTimestamp,
  onSnapshot, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  getStorage, ref, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDNg6iwpXItYxrQOt_bF6FbK4S6qjYFW6Q",
  authDomain: "manutencaosenai-d235a.firebaseapp.com",
  projectId: "manutencaosenai-d235a",
  storageBucket: "manutencaosenai-d235a.appspot.com",
  messagingSenderId: "56330243054",
  appId: "1:56330243054:web:4729db391af5e906e49cff"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Sessão por aba (desloga ao fechar o navegador)
setPersistence(auth, browserSessionPersistence);

export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged,
  addDoc, collection, serverTimestamp, onSnapshot, query, where, orderBy,
  ref, uploadString, getDownloadURL
};
