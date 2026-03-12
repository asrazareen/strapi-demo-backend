"use strict";
/**
 * business controller
 */
const strapi_1 = require("@strapi/strapi");
module.exports = strapi_1.factories.createCoreController(
    "api::business.business",
    () => ({
        async find(ctx) {
            if (!ctx.query.sort) {
                ctx.query.sort = ["createdAt:desc"];
            }
            return await super.find(ctx);
        },
    })
);
