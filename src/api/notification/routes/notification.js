"use strict";

const { validateRequest } = require("../../../middlewares/validateRequest");
const {
  createNotificationTriggerSchema,
} = require("../../../validators/notificationValidators");

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/notifications/trigger",
      handler: "notification.trigger",
      config: {
        auth: false,
        middlewares: [validateRequest(createNotificationTriggerSchema)],
      },
    },
    {
      method: "GET",
      path: "/notifications/debug/:userId",
      handler: "notification.debug",
      config: {
        auth: false,
      },
    },
  ],
};
