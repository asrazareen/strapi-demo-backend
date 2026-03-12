"use strict";

module.exports = (plugin) => {
  const originalMe = plugin.controllers.user.me;

  plugin.controllers.user.me = async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const userWithRole = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      user.id,
      {
        populate: ["role"],
      },
    );
    ctx.body = userWithRole;
  };

  return plugin;
};
