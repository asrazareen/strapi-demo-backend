"use strict";
const { sendNotification } = require("../../../../utils/sendNotification.js");

const getStrapi = (event) => event?.strapi || global.strapi;

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const collectTokens = (owner) => {
  const directToken = owner?.fcmToken;
  const deviceTokens = Array.isArray(owner?.deviceTokens)
    ? owner.deviceTokens.map((d) => d?.token)
    : [];
  return [...new Set([directToken, ...deviceTokens].filter(Boolean))];
};

const getInvalidTokensFromResponse = (tokens, response) => {
  if (!Array.isArray(tokens) || !tokens.length) return [];
  if (!response || !Array.isArray(response.responses)) return [];

  return response.responses
    .map((item, idx) => {
      const code = item?.error?.code;
      if (!item?.success && INVALID_TOKEN_CODES.has(code)) {
        return tokens[idx];
      }
      return null;
    })
    .filter(Boolean);
};

const pruneInvalidTokens = async (strapi, owner, invalidTokens) => {
  const uniqueInvalidTokens = [...new Set((invalidTokens || []).filter(Boolean))];
  if (!strapi || !owner?.id || !uniqueInvalidTokens.length) return;

  for (const token of uniqueInvalidTokens) {
    try {
      const rows = await strapi.entityService.findMany(
        "api::device-token.device-token",
        {
          filters: {
            token,
            user: { id: owner.id },
          },
          fields: ["id", "token"],
          limit: 50,
        }
      );

      for (const row of rows || []) {
        await strapi.entityService.delete("api::device-token.device-token", row.id);
      }

      // Backward compatibility: if token is stored directly on user, clear it.
      if (owner.fcmToken && owner.fcmToken === token) {
        await strapi.entityService.update("plugin::users-permissions.user", owner.id, {
          data: { fcmToken: null },
        });
      }

      if ((rows || []).length > 0 || owner.fcmToken === token) {
        strapi.log.info(
          `[push] Pruned invalid token for user ${owner.id}: ${token}`
        );
      }
    } catch (err) {
      strapi.log.error(
        `[push] Failed to prune invalid token for user ${owner.id}: ${err.message}`
      );
    }
  }
};

const getUserDeviceTokens = async (strapi, userId) => {
  if (!strapi || !userId) return [];
  try {
    const rows = await strapi.entityService.findMany(
      "api::device-token.device-token",
      {
        filters: { user: { id: userId } },
        fields: ["token"],
        limit: 100,
      }
    );

    return [...new Set((rows || []).map((r) => r?.token).filter(Boolean))];
  } catch (err) {
    strapi.log.error(`[push] Failed to fetch customer device tokens: ${err.message}`);
    return [];
  }
};

module.exports = {
  afterCreate: async (event) => {
    const strapi = getStrapi(event);
    const { result } = event;

    if (!strapi || !result?.id) {
      return;
    }

    try {
      // Fetch the booking with related service and business
      const booking = await strapi.entityService.findOne(
        "api::booking.booking",
        result.id,
        {
          populate: {
            service: {
              populate: {
                business: {
                  populate: {
                    owner: {
                      populate: ["deviceTokens"],
                    },
                  },
                },
              },
            },
            user: {
              populate: ["deviceTokens"],
            },
          },
        }
      );

      if (!booking) {
        strapi.log.warn("[push] Booking not found for lifecycle afterCreate");
        return;
      }

      // Send notification to CUSTOMER
      const customerOwner = booking.user;
      const customerDeviceTokens = await getUserDeviceTokens(strapi, booking.user?.id);
      const customerTokens = [
        result.customerFcmToken,
        booking.user?.fcmToken,
        ...(Array.isArray(booking.user?.deviceTokens)
          ? booking.user.deviceTokens.map((d) => d?.token)
          : []),
        ...customerDeviceTokens,
      ].filter(Boolean);

      const uniqueCustomerTokens = [...new Set(customerTokens)];

      if (uniqueCustomerTokens.length) {
        const customerResponse = await sendNotification(uniqueCustomerTokens, {
          title: "Booking Confirmed",
          body: `Your booking for ${booking.service?.name || "the service"} is confirmed.`,
          data: { bookingId: result.id.toString() },
        });

        strapi.log.info(
          `[push] Customer notification result: ${JSON.stringify(customerResponse)}`
        );

        const customerInvalidTokens = getInvalidTokensFromResponse(
          uniqueCustomerTokens,
          customerResponse
        );
        await pruneInvalidTokens(strapi, customerOwner, customerInvalidTokens);
      } else {
        strapi.log.info("[push] No customer FCM token provided");
      }

      // Send notification to MERCHANT (business owner)
      const businessOwner = booking.service?.business?.owner;
      const merchantTokens = collectTokens(businessOwner);

      if (merchantTokens.length) {
        const customerName = result.customer_name || "A customer";
        const bookingTime = result.booking_time
          ? new Date(result.booking_time).toLocaleString()
          : "Unknown time";

        const merchantResponse = await sendNotification(merchantTokens, {
          title: "New Booking Received",
          body: `${customerName} booked ${booking.service?.name || "a service"} for ${bookingTime}.`,
          data: { bookingId: result.id.toString() },
        });

        strapi.log.info(
          `[push] Merchant notification result: ${JSON.stringify(merchantResponse)}`
        );

        const merchantInvalidTokens = getInvalidTokensFromResponse(
          merchantTokens,
          merchantResponse
        );
        await pruneInvalidTokens(strapi, businessOwner, merchantInvalidTokens);
      } else {
        strapi.log.info("[push] No merchant FCM token available");
      }
    } catch (error) {
      strapi.log.error("[push] Error sending notifications: " + error.message);
    }
  },
};
