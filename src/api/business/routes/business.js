"use strict";
const strapi_1 = require("@strapi/strapi");
const validateRequest_1 = require("../../../middlewares/validateRequest");
const businessValidators_1 = require("../../../validators/businessValidators");
module.exports = strapi_1.factories.createCoreRouter("api::business.business", {
    config: { create: { middlewares: [(0, validateRequest_1.validateRequest)(businessValidators_1.createBusinessSchema)] } },
});
