import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "noxplay-444cd.firebaseapp.com",
  projectId: "noxplay-444cd",
  storageBucket: "noxplay-444cd.firebasestorage.app",
  messagingSenderId: "192943528361",
  appId: "1:192943528361:web:64cc2f097f794f4b88ccb8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };