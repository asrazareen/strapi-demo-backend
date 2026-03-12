"use strict";
const axios = require("axios");
module.exports = {
    async autocomplete(ctx) {
        const { input, mode = "all", country } = ctx.query;
        if (!input || !String(input).trim()) {
            return ctx.badRequest("input is required");
        }

        const params = {
            input,
            key: process.env.GOOGLE_API_KEY,
        };

        // mode=address -> only addresses
        // mode=establishment -> business names (e.g. Domino's)
        // mode=all (default) -> no type restriction
        if (mode === "address") params.types = "address";
        if (mode === "establishment") params.types = "establishment";

        if (country) {
            params.components = `country:${country}`;
        }

        const response = await axios.get(
            "https://maps.googleapis.com/maps/api/place/autocomplete/json",
            { params }
        );

        const suggestions = response.data.predictions.map((place) => ({
            description: place.description,
            place_id: place.place_id,
        }));
        ctx.body = suggestions;
    },
    async placeDetails(ctx) {
        const { place_id } = ctx.query;
        const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
            params: {
                place_id,
                key: process.env.GOOGLE_API_KEY,
            },
        });
        const result = response.data.result;
        const location = result.geometry.location;
        let city = null;
        const cityComponent = result.address_components.find((c) => c.types.includes("locality"));
        if (cityComponent) {
            city = cityComponent.long_name;
        }
        ctx.body = {
            address: result.formatted_address,
            city: city,
            latitude: location.lat,
            longitude: location.lng,
        };
    },
};
