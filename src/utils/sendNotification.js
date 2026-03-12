"use strict";
const { getFirebaseAdmin } = require("./firebase.js");

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const getErrorCode = (error) => {
  if (!error || typeof error !== "object") return null;
  return error.code || error.errorInfo?.code || null;
};

const cleanupInvalidTokens = async (tokens) => {
  if (!global.strapi || !Array.isArray(tokens) || !tokens.length) {
    return { removedDeviceTokens: 0, clearedUserTokens: 0 };
  }

  const uniqueTokens = [...new Set(tokens)];

  const [deviceTokenEntries, users] = await Promise.all([
    global.strapi.entityService.findMany("api::device-token.device-token", {
      filters: { token: { $in: uniqueTokens } },
      fields: ["id", "token"],
      limit: 10000,
    }),
    global.strapi.entityService.findMany("plugin::users-permissions.user", {
      filters: { fcmToken: { $in: uniqueTokens } },
      fields: ["id", "fcmToken"],
      pagination: { page: 1, pageSize: 10000 },
    }),
  ]);

  await Promise.all([
    ...(deviceTokenEntries || []).map((entry) =>
      global.strapi.entityService.delete("api::device-token.device-token", entry.id)
    ),
    ...(users || []).map((user) =>
      global.strapi.entityService.update("plugin::users-permissions.user", user.id, {
        data: { fcmToken: null },
      })
    ),
  ]);

  return {
    removedDeviceTokens: (deviceTokenEntries || []).length,
    clearedUserTokens: (users || []).length,
  };
};

const formatResponse = async (tokens, response) => {
  const failures = [];
  const invalidTokens = [];

  if (response.responses) {
    response.responses.forEach((result, index) => {
      if (result.success) {
        return;
      }

      const token = tokens[index];
      const code = getErrorCode(result.error);
      const message = result.error?.message || "Unknown messaging error";

      failures.push({ token, code, message });

      if (token && INVALID_TOKEN_CODES.has(code)) {
        invalidTokens.push(token);
      }

      console.error(`Token ${token} failed:`, result.error);
    });
  }

  const cleanup = await cleanupInvalidTokens(invalidTokens);

  return {
    successCount: response.successCount || 0,
    failureCount: response.failureCount || 0,
    invalidTokens: [...new Set(invalidTokens)],
    failures,
    cleanup,
  };
};

const sendNotification = async (registrationTokens, payload) => {
  const firebaseAdmin = getFirebaseAdmin();
  const tokens = (
    Array.isArray(registrationTokens)
      ? registrationTokens
      : [registrationTokens]
  ).filter(Boolean);

  if (!tokens.length) {
    return {
      successCount: 0,
      failureCount: 0,
      skipped: true,
      reason: "No registration tokens",
    };
  }

  if (!firebaseAdmin) {
    return {
      successCount: 0,
      failureCount: tokens.length,
      skipped: true,
      reason: "Firebase not configured",
    };
  }

  const webLink =
    payload.link ||
    process.env.WEB_PUSH_LINK ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_URL;

  const webpushNotification = {
    title: payload.title,
    body: payload.body,
  };

  if (process.env.WEB_PUSH_ICON)
    webpushNotification.icon = process.env.WEB_PUSH_ICON;
  if (process.env.WEB_PUSH_BADGE)
    webpushNotification.badge = process.env.WEB_PUSH_BADGE;

  const webpush = {
    notification: webpushNotification,
  };

  if (webLink) {
    webpush.fcmOptions = { link: webLink };
  }

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    webpush,
    tokens,
  };

  const messaging = firebaseAdmin.messaging();

  if (typeof messaging.sendEachForMulticast === "function") {
    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(
        "Sent:",
        response.successCount,
        "Failed:",
        response.failureCount,
      );
      return await formatResponse(tokens, response);
    } catch (err) {
      console.error("sendEachForMulticast error:", err);
      return {
        successCount: 0,
        failureCount: tokens.length,
        error: err.message || err,
        skipped: false,
      };
    }
  }

  if (typeof messaging.sendMulticast === "function") {
    try {
      const response = await messaging.sendMulticast(message);
      console.log(
        "Sent:",
        response.successCount,
        "Failed:",
        response.failureCount,
      );
      return await formatResponse(tokens, response);
    } catch (err) {
      console.error("sendMulticast error:", err);
      return {
        successCount: 0,
        failureCount: tokens.length,
        error: err.message || err,
        skipped: false,
      };
    }
  }

  return {
    successCount: 0,
    failureCount: tokens.length,
    skipped: true,
    reason: "No compatible Firebase messaging multicast method found",
  };
};

module.exports = { sendNotification };
