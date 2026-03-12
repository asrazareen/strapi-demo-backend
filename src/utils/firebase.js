"use strict";
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let firebaseAdmin = null;

const getFirebaseAdmin = () => {
    if (firebaseAdmin) {
        return firebaseAdmin;
    }

    const serviceAccountPath = path.resolve(
        process.cwd(),
        "config/firebase-service-account.json"
    );

    if (!fs.existsSync(serviceAccountPath)) {
        return null;
    }

    try {
        const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, "utf-8")
        );

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }

        firebaseAdmin = admin;
        return firebaseAdmin;
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
        return null;
    }
};

module.exports = { getFirebaseAdmin };
