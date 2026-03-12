"use strict";
/**
 * booking router
 */
const strapi_1 = require("@strapi/strapi");
const { validateRequest } = require("../../../middlewares/validateRequest");
const { createBookingSchema } = require("../../../validators/bookingValidators");

module.exports = strapi_1.factories.createCoreRouter("api::booking.booking", {
    config: {
        create: {
            middlewares: [validateRequest(createBookingSchema)],
        },
    },
});
