"use strict";

const { createEmailTriggerSchema } = require("../../../validators/emailValidators");
const { sendEmail } = require("../../../utils/sendEmail");

module.exports = {
  async trigger(ctx) {
    const expectedToken = process.env.EMAIL_TRIGGER_TOKEN;
    const providedToken = ctx.request.header["x-email-token"];

    if (!expectedToken) {
      return ctx.internalServerError("EMAIL_TRIGGER_TOKEN is not configured");
    }

    if (providedToken !== expectedToken) {
      return ctx.unauthorized("Invalid email trigger token");
    }

    const result = createEmailTriggerSchema.safeParse(ctx.request.body?.data || {});

    if (!result.success) {
      const firstError = result.error.issues[0];
      return ctx.badRequest("Validation Error", {
        field: firstError.path[0],
        message: firstError.message,
      });
    }

    try {
      const response = await sendEmail(strapi, result.data);

      ctx.body = {
        message: "Email trigger executed",
        result: response,
      };
    } catch (error) {
      strapi.log.error(`[email-trigger] ${error.message}`);
      return ctx.badGateway("Failed to send email", {
        message: error.message,
      });
    }
  },
};
