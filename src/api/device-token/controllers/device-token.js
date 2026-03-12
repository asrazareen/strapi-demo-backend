"use strict";

const { factories } = require("@strapi/strapi");

module.exports = factories.createCoreController(
  "api::device-token.device-token",
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Login required");
      }

      const payload = ctx.request.body?.data || {};
      if (!payload.token) {
        return ctx.badRequest("token is required");
      }

      const existing = await strapi.entityService.findMany(
        "api::device-token.device-token",
        {
          filters: { token: payload.token },
          limit: 1,
        }
      );

      if (existing.length) {
        if (payload.platform === "web") {
          const olderWebTokens = await strapi.entityService.findMany(
            "api::device-token.device-token",
            {
              filters: {
                user: { id: user.id },
                platform: "web",
                token: { $ne: payload.token },
              },
              fields: ["id"],
              limit: 100,
            }
          );

          await Promise.all(
            (olderWebTokens || []).map((entry) =>
              strapi.entityService.delete("api::device-token.device-token", entry.id)
            )
          );
        }

        const updated = await strapi.entityService.update(
          "api::device-token.device-token",
          existing[0].id,
          { data: { ...payload, user: user.id } }
        );
        return this.transformResponse(updated);
      }

      if (payload.platform === "web") {
        const olderWebTokens = await strapi.entityService.findMany(
          "api::device-token.device-token",
          {
            filters: {
              user: { id: user.id },
              platform: "web",
            },
            fields: ["id"],
            limit: 100,
          }
        );

        await Promise.all(
          (olderWebTokens || []).map((entry) =>
            strapi.entityService.delete("api::device-token.device-token", entry.id)
          )
        );
      }

      ctx.request.body.data = { ...payload, user: user.id };
      return await super.create(ctx);
    },
  })
);
