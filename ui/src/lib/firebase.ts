import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const app = initializeApp({
    apiKey: "AIzaSyCvItN3pESFWUnghwwJbz-8NEKkz4tkN_w",
    authDomain: "project-dialga.firebaseapp.com",
    projectId: "project-dialga",
    storageBucket: "project-dialga.firebasestorage.app",
    messagingSenderId: "783964685338",
    appId: "1:783964685338:web:de0282965951d900b1fda3",
    measurementId: "G-YGER8EWBJ0"
});

export const analytics = getAnalytics(app);
export const auth = getAuth(app);
