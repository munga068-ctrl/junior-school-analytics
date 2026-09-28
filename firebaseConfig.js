import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Fill these in from Firebase console: Project settings > General > Your apps > SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDQ8nZuGxA_IB2701hhWRZ7rnXve_52LzI",
  authDomain: "jsanalytics-8f1cb.firebaseapp.com",
  projectId: "jsanalytics-8f1cb",
  storageBucket: "jsanalytics-8f1cb.firebasestorage.app",
  messagingSenderId: "831625227463",
  appId: "1:831625227463:web:62cbd1e773c0292bb922e2",
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

// A second, independent Firebase app instance used ONLY for creating teacher
// login accounts from within the admin's session. Firebase's client SDK signs
// the *current* user out whenever you create a new account on the same auth
// instance — routing account creation through this separate instance keeps
// the admin's own session untouched.
const secondaryApp =
  getApps().find((a) => a.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
