"use strict";

const { z } = require("zod");

const createBusinessSchema = z.object({
    name: z
        .string()
        .min(1, "Business name is required")
        .min(2, "Business name must be at least 2 characters"),
    email: z.string().min(1, "Email is required").email("Email is not valid"),
    phone: z
        .string()
        .min(1, "Phone is required")
        .min(10, "Phone number must be at least 10 digits")
        .regex(/^[0-9]+$/, "Phone must contain only digits"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
});

module.exports = { createBusinessSchema };
