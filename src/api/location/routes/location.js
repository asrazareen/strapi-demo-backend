"use strict";
module.exports = {
    routes: [
        {
            method: "GET",
            path: "/address-autocomplete",
            handler: "location.autocomplete",
            config: {
                auth: false,
            },
        },
        {
            method: "GET",
            path: "/place-details",
            handler: "location.placeDetails",
            config: {
                auth: false,
            },
        },
    ],
};
