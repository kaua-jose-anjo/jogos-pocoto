/* =========================================================
   CONFIGURAÇÃO GLOBAL FIREBASE — POCOTÓ GAMES
   ========================================================= */
const firebaseConfig = {
    apiKey: "AIzaSyACXSazPwG_9e1xU5zPeofXN8jqzosIpg0",
    authDomain: "pocoto-games.firebaseapp.com",
    projectId: "pocoto-games",
    storageBucket: "pocoto-games.firebasestorage.app",
    messagingSenderId: "476172977921",
    appId: "1:476172977921:web:41103cf271321ae2d6bd00",
    measurementId: "G-J9GQXT44L9"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.fbAuth = firebase.auth();
window.fbDb = firebase.firestore();