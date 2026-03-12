"use strict";

const validateRequest = (schema) => {
    return async (ctx, next) => {
        const result = schema.safeParse(ctx.request.body.data);
        if (!result.success) {
            const firstError = result.error.issues[0];
            return ctx.badRequest("Validation Error", {
                field: firstError.path[0],
                message: firstError.message,
            });
        }
        ctx.request.body.data = result.data;
        await next();
    };
};

module.exports = { validateRequest };
