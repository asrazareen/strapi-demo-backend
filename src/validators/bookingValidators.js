"use strict";

const { z } = require("zod");

const createBookingSchema = z
  .object({
    availability: z.coerce.number().int().positive("availability must be a valid id"),
    service: z.coerce.number().int().positive("service must be a valid id").optional(),
    customer_name: z.string().trim().min(1).max(120).optional(),
    customer_email: z.string().trim().email("customer_email is not valid").optional(),
    customer_phone: z
      .string()
      .trim()
      .min(7, "customer_phone must be at least 7 digits")
      .max(20, "customer_phone must be at most 20 characters")
      .regex(/^[0-9+\-\s()]+$/, "customer_phone format is invalid")
      .optional(),
    customerFcmToken: z.string().trim().min(20).max(4096).optional(),
    booking_time: z.string().datetime().optional(),
    booking_status: z
      .enum(["confirmed", "pending", "completed", "rejected"])
      .optional(),
  })
  .strict();

module.exports = { createBookingSchema };
