"use strict";
module.exports = {
  routes: [
    {
      method: "GET",
      path: "/my-bookings", // ← change this
      handler: "booking.myBookings",
      config: {
        auth: {},
      },
    },
    {
      method: "PATCH",
      path: "/bookings/:id/cancel",
      handler: "booking.cancel",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/bookings-export",
      handler: "booking.exportBookings",
      config: {
        auth: false,
      },
    },
  ],
};
