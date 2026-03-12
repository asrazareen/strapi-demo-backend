"use strict";

const { z } = require("zod");

const createNotificationTriggerSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
    link: z.string().trim().url().optional(),
    data: z.record(z.any()).optional(),
    tokens: z.array(z.string().trim().min(20)).min(1).optional(),
    userIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
  })
  .refine((value) => Boolean(value.tokens?.length || value.userIds?.length), {
    message: "Provide at least one target via tokens or userIds",
    path: ["tokens"],
  })
  .strict();

module.exports = { createNotificationTriggerSchema };
