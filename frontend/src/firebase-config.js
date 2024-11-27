// Import Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWb19J68H1l6J0wbetZ5QUZ69JdEnMPDM",
  authDomain: "townhalltown.firebaseapp.com",
  projectId: "townhalltown",
  storageBucket: "townhalltown.firebasestorage.app",
  messagingSenderId: "307357602530",
  appId: "1:307357602530:web:74c747b9e861c0475304bb",
  measurementId: "G-TZJTKDT7JC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Export what we need
export { auth, provider };
export default app;
