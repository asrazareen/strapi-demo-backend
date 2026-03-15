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
    "src/utils/firebase-service-account.js",
  );

  if (!fs.existsSync(serviceAccountPath)) {
    return null;
  }

  try {
    let serviceAccount = require(serviceAccountPath);

    if (!serviceAccount?.private_key || !serviceAccount?.client_email) {
      return null;
    }

    // Handle ESM default export if present
    if (serviceAccount.default) {
      serviceAccount = serviceAccount.default;
    }

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
