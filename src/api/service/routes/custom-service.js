"use strict";
module.exports = {
    routes: [
        {
            method: "GET",
            path: "/services/:id/available-slots",
            handler: "service.availableSlots",
            config: {
                auth: false,
            },
        },
        {
            method: "POST",
            path: "/services/slots/sync",
            handler: "service.syncRollingSlots",
            config: {
                auth: {},
            },
        },
    ],
};
