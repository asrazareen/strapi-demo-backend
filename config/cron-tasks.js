"use strict";

const { ensureRollingSlots } = require("../src/utils/ensure-rolling-slots");

module.exports = {
  ensureRollingSlots: {
    task: async ({ strapi }) => {
      const result = await ensureRollingSlots(strapi, { daysAhead: 7 });
      strapi.log.info(
        `[cron] ensureRollingSlots completed: services=${result.services}, created=${result.created}, startDate=${result.startDate}, daysAhead=${result.daysAhead}`
      );
    },
    options: {
      rule: "0 6 * * *",
      tz: "Asia/Kolkata",
    },
  },
};
