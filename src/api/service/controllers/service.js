"use strict";
/**
 * service controller
 */
const strapi_1 = require("@strapi/strapi");
const { generateSlots } = require("../../../utils/generate-slots");
const { ensureRollingSlots } = require("../../../utils/ensure-rolling-slots");
const formatTime = (time) => {
    if (!time)
        return "00:00:00.000";
    // Handle both HH:mm and HH:mm:ss.SSS
    const parts = time.split(":");
    const h = parts[0] || "00";
    const m = parts[1] || "00";
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00.000`;
};
module.exports = strapi_1.factories.createCoreController("api::service.service", ({ strapi }) => ({
    async find(ctx) {
        if (!ctx.query.sort) {
            ctx.query.sort = ["createdAt:desc"];
        }
        return await super.find(ctx);
    },
    async create(ctx) {
        const { start_time, end_time, days_open, duration } = ctx.request.body.data;
        // Format before saving to ensure DB consistency
        if (start_time)
            ctx.request.body.data.start_time = formatTime(start_time);
        if (end_time)
            ctx.request.body.data.end_time = formatTime(end_time);
        const response = await super.create(ctx);
        const { data } = response;
        if (!data)
            return response;
        const id = data.id;
        if (start_time && end_time && days_open && duration) {
            const formattedStart = formatTime(start_time);
            const formattedEnd = formatTime(end_time);
            await generateSlots(strapi, {
                id,
                start_time: formattedStart,
                end_time: formattedEnd,
                days_open,
                duration: parseInt(duration),
            }, { daysAhead: 7 });
        }
        return response;
    },
    async update(ctx) {
        const { id } = ctx.params;
        const { start_time, end_time, days_open, duration } = ctx.request.body.data;
        // Get existing service to compare
        const existing = (await strapi.documents("api::service.service").findOne({
            documentId: id,
        }));
        if (!existing)
            return ctx.notFound("Service not found");
        // Format times before comparison and update
        if (start_time)
            ctx.request.body.data.start_time = formatTime(start_time);
        if (end_time)
            ctx.request.body.data.end_time = formatTime(end_time);
        const response = await super.update(ctx);
        // Check if schedule changed
        const scheduleChanged = (start_time && formatTime(start_time) !== existing.start_time) ||
            (end_time && formatTime(end_time) !== existing.end_time) ||
            (days_open &&
                JSON.stringify(days_open) !== JSON.stringify(existing.days_open)) ||
            (duration && parseInt(duration) !== existing.duration);
        if (scheduleChanged) {
            // 1. Delete future unbooked availabilities
            const futureAvailabilities = await strapi
                .documents("api::availability.availability")
                .findMany({
                filters: {
                    service: existing.id,
                    is_booked: false,
                    date: { $gte: new Date().toISOString().split("T")[0] },
                },
            });
            for (const avail of futureAvailabilities) {
                await strapi.documents("api::availability.availability").delete({
                    documentId: avail.documentId,
                });
            }
            // 2. Regenerate slots
            await generateSlots(strapi, {
                id: existing.id,
                start_time: ctx.request.body.data.start_time || existing.start_time,
                end_time: ctx.request.body.data.end_time || existing.end_time,
                days_open: ctx.request.body.data.days_open || existing.days_open,
                duration: parseInt(ctx.request.body.data.duration || existing.duration),
            }, { daysAhead: 7 });
        }
        return response;
    },
    async availableSlots(ctx) {
        const { id } = ctx.params;
        const service = (await strapi.entityService.findOne("api::service.service", id, {
            populate: ["availabilities"],
        }));
        if (!service) {
            return ctx.notFound("Service not found");
        }
        let availabilities = service.availabilities || [];
        const slots = availabilities.map((slot) => ({
            id: slot.id,
            documentId: slot.documentId,
            date: slot.date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_booked: slot.is_booked,
        }));
        ctx.body = {
            service_id: id,
            total_slots: slots.length,
            slots,
        };
    },
    async syncRollingSlots(ctx) {
        const tokenFromHeader = ctx.request.header["x-slots-sync-token"];
        const expectedToken = process.env.SLOTS_SYNC_TOKEN;
        if (expectedToken && tokenFromHeader !== expectedToken) {
            return ctx.unauthorized("Invalid sync token");
        }

        const daysAheadRaw = Number(ctx.request.body?.daysAhead || ctx.query?.daysAhead || 7);
        const daysAhead = Number.isFinite(daysAheadRaw) && daysAheadRaw > 0
            ? Math.floor(daysAheadRaw)
            : 7;

        const result = await ensureRollingSlots(strapi, { daysAhead });
        ctx.body = {
            message: "Rolling slots synced",
            ...result,
        };
    },
}));
