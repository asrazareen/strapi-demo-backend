"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/emails/trigger",
      handler: "email.trigger",
      config: {
        auth: false,
      },
    },
  ],
};
