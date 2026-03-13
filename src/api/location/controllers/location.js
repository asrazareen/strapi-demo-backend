"use strict";
const axios = require("axios");

const formatGoogleTime = (time) => {
    if (!time || typeof time !== "string" || time.length !== 4) {
        return null;
    }

    const hours = Number(time.slice(0, 2));
    const minutes = time.slice(2);

    if (Number.isNaN(hours)) {
        return null;
    }

    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${minutes} ${period}`;
};

const getPlaceDayIndex = (utcOffsetMinutes) => {
    if (typeof utcOffsetMinutes !== "number") {
        return new Date().getDay();
    }

    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcMs + utcOffsetMinutes * 60000).getDay();
};

const getClosingTimeForToday = (result) => {
    const openingHours = result.current_opening_hours || result.opening_hours;
    const periods = openingHours?.periods;

    if (!Array.isArray(periods) || !periods.length) {
        return { raw: null, formatted: null };
    }

    const today = getPlaceDayIndex(result.utc_offset_minutes);
    const currentPeriod = periods.find(
        (period) => period?.open?.day === today && period?.close?.time,
    );

    const raw = currentPeriod?.close?.time || null;

    return {
        raw,
        formatted: formatGoogleTime(raw),
    };
};

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
        const openingHours = result.current_opening_hours || result.opening_hours;
        const closingTime = getClosingTimeForToday(result);
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
            is_open: openingHours?.open_now ?? null,
            closing_time_today: closingTime.raw,
            closing_time_today_formatted: closingTime.formatted,
            weekday_hours: openingHours?.weekday_text || [],
            business_status: result.business_status || null,
        };
    },
};
