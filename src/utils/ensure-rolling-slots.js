"use strict";

const { generateSlots } = require("./generate-slots");

const ensureRollingSlots = async (strapi, options = {}) => {
  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  startDate.setHours(0, 0, 0, 0);
  const daysAhead = Number(options.daysAhead || 7);

  const services = await strapi.entityService.findMany("api::service.service", {
    fields: ["id", "start_time", "end_time", "days_open", "duration"],
    pagination: { page: 1, pageSize: 10000 },
  });

  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  let totalCreated = 0;
  const skippedServices = [];
  const createdByService = [];

  for (const service of services || []) {
    const daysOpen = Array.isArray(service.days_open) ? service.days_open : [];
    const hasValidDay = daysOpen.some((d) => dayMap[String(d).toLowerCase()] !== undefined);

    if (!service.start_time || !service.end_time || !service.duration || !hasValidDay) {
      const missing = [];
      if (!service.start_time) missing.push("start_time");
      if (!service.end_time) missing.push("end_time");
      if (!service.duration) missing.push("duration");
      if (!hasValidDay) missing.push("days_open");
      skippedServices.push({
        id: service.id,
        missing,
      });
      continue;
    }

    const created = await generateSlots(
      strapi,
      {
        id: service.id,
        start_time: service.start_time,
        end_time: service.end_time,
        days_open: service.days_open,
        duration: service.duration,
      },
      { startDate, daysAhead }
    );
    totalCreated += created;
    if (created > 0) {
      createdByService.push({ id: service.id, created });
    }
  }

  return {
    services: (services || []).length,
    eligibleServices: (services || []).length - skippedServices.length,
    created: totalCreated,
    daysAhead,
    startDate: startDate.toISOString().slice(0, 10),
    skippedServices,
    createdByService,
  };
};

module.exports = { ensureRollingSlots };
