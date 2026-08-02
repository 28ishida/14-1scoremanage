import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
   apiKey: "AIzaSyCnjt3YoM0AQTNNK__bbzpLtnpqVOWejJ8",
   authDomain: "scoremanage-e8c7f.firebaseapp.com",
   projectId: "scoremanage-e8c7f",
   storageBucket: "scoremanage-e8c7f.firebasestorage.app",
   messagingSenderId: "979645457672",
   appId: "1:979645457672:web:f1969ec60f72ab90bf38bd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);