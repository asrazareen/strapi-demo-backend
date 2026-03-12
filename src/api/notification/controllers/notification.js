"use strict";

const { sendNotification } = require("../../../utils/sendNotification");

const maskToken = (token) => {
  if (!token || typeof token !== "string") return null;
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

const toStringMap = (data) => {
  const input = data && typeof data === "object" ? data : {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
};

const resolveNotificationTargets = async (strapi, userIds) => {
  if (!Array.isArray(userIds) || !userIds.length) return [];

  const normalizedUserIds = [...new Set(userIds.map((id) => Number(id)).filter(Boolean))];

  const deviceTokens = await strapi.entityService.findMany(
    "api::device-token.device-token",
    {
      filters: { user: { id: { $in: normalizedUserIds } } },
      fields: ["token", "platform", "createdAt"],
      populate: {
        user: {
          fields: ["id"],
        },
      },
      sort: ["createdAt:desc"],
      pagination: { page: 1, pageSize: 10000 },
    }
  );

  const latestTokenByUserId = new Map();

  for (const tokenRow of deviceTokens || []) {
    const userId = tokenRow?.user?.id;
    const token = tokenRow?.token;

    if (!userId || !token || latestTokenByUserId.has(userId)) {
      continue;
    }

    latestTokenByUserId.set(userId, {
      userId,
      token,
      source: "deviceTokens",
      platform: tokenRow?.platform || null,
      createdAt: tokenRow?.createdAt || null,
    });
  }

  const usersMissingDeviceTokens = normalizedUserIds.filter(
    (userId) => !latestTokenByUserId.has(userId)
  );

  if (usersMissingDeviceTokens.length) {
    const fallbackUsers = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      {
        filters: {
          id: { $in: usersMissingDeviceTokens },
        },
        fields: ["id", "fcmToken"],
        pagination: { page: 1, pageSize: 10000 },
      }
    );

    for (const user of fallbackUsers || []) {
      if (user?.id && user?.fcmToken && !latestTokenByUserId.has(user.id)) {
        latestTokenByUserId.set(user.id, {
          userId: user.id,
          token: user.fcmToken,
          source: "fcmToken",
          platform: "legacy",
          createdAt: null,
        });
      }
    }
  }

  return normalizedUserIds.map((userId) => {
    const resolved = latestTokenByUserId.get(userId);
    if (resolved) {
      return {
        ...resolved,
        tokenMasked: maskToken(resolved.token),
      };
    }

    return {
      userId,
      token: null,
      tokenMasked: null,
      source: null,
      platform: null,
      createdAt: null,
    };
  });
};

module.exports = {
  async trigger(ctx) {
    const expectedToken = process.env.NOTIFICATION_TRIGGER_TOKEN;
    const providedToken = ctx.request.header["x-notification-token"];

    if (!expectedToken) {
      return ctx.internalServerError("NOTIFICATION_TRIGGER_TOKEN is not configured");
    }

    if (providedToken !== expectedToken) {
      return ctx.unauthorized("Invalid notification trigger token");
    }

    const payload = ctx.request.body?.data || {};
    const { title, body, link, data, tokens = [], userIds = [] } = payload;

    const resolvedTargets = await resolveNotificationTargets(strapi, userIds);
    const userTokens = resolvedTargets.map((target) => target.token).filter(Boolean);
    const mergedTokens = [...new Set([...(tokens || []), ...userTokens])];

    if (!mergedTokens.length) {
      return ctx.badRequest("No valid device tokens resolved");
    }

    strapi.log.info(
      `[notification-trigger] ${JSON.stringify({
        userIds,
        resolvedTargets: resolvedTargets.map((target) => ({
          userId: target.userId,
          tokenMasked: target.tokenMasked,
          source: target.source,
          platform: target.platform,
          createdAt: target.createdAt,
        })),
        directTokens: (tokens || []).map(maskToken),
        totalTokens: mergedTokens.length,
        title,
      })}`
    );

    const result = await sendNotification(mergedTokens, {
      title,
      body,
      link,
      data: toStringMap(data),
    });

    strapi.log.info(
      `[notification-result] ${JSON.stringify({
        userIds,
        totalTokens: mergedTokens.length,
        successCount: result?.successCount || 0,
        failureCount: result?.failureCount || 0,
        invalidTokens: (result?.invalidTokens || []).map(maskToken),
        failures: (result?.failures || []).map((failure) => ({
          tokenMasked: maskToken(failure.token),
          code: failure.code,
          message: failure.message,
        })),
      })}`
    );

    ctx.body = {
      message: "Notification trigger executed",
      totalTokens: mergedTokens.length,
      result,
    };
  },

  async debug(ctx) {
    const expectedToken = process.env.NOTIFICATION_TRIGGER_TOKEN;
    const providedToken = ctx.request.header["x-notification-token"];

    if (!expectedToken) {
      return ctx.internalServerError("NOTIFICATION_TRIGGER_TOKEN is not configured");
    }

    if (providedToken !== expectedToken) {
      return ctx.unauthorized("Invalid notification trigger token");
    }

    const userId = Number(ctx.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return ctx.badRequest("userId must be a positive integer");
    }

    const resolvedTargets = await resolveNotificationTargets(strapi, [userId]);
    const target = resolvedTargets[0];

    ctx.body = {
      message: "Notification debug resolved",
      userId,
      target: {
        userId: target.userId,
        hasToken: Boolean(target.token),
        tokenMasked: target.tokenMasked,
        source: target.source,
        platform: target.platform,
        createdAt: target.createdAt,
      },
    };
  },
};
