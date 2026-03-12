"use strict";
const generate_slots_1 = require("../../../../utils/generate-slots");

const getStrapi = (event) => event?.strapi || global.strapi;

module.exports = {
    async afterCreate(event) {
        const strapi = getStrapi(event);
        const { result } = event;
        if (!strapi) return;
        if (!result?.id) return;
        const existingSlots = await strapi.entityService.findMany(
            "api::availability.availability",
            {
                filters: { service: result.id },
                limit: 1,
            }
        );
        if (existingSlots.length) return;
        await (0, generate_slots_1.generateSlots)(strapi, result);
    },
    async afterUpdate(event) {
        const strapi = getStrapi(event);
        const { result } = event;
        if (!strapi) return;
        if (!result?.id) return;
        const today = new Date().toISOString().split("T")[0];
        const oldSlots = await strapi.entityService.findMany(
            "api::availability.availability",
            {
                filters: {
                    service: result.id,
                    is_booked: false,
                    date: { $gte: today },
                },
            }
        );
        for (const slot of oldSlots || []) {
            await strapi.entityService.delete("api::availability.availability", slot.id);
        }
        await (0, generate_slots_1.generateSlots)(strapi, result);
    },
};
