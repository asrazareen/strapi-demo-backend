"use strict";

const { z } = require("zod");

const emailAddressSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  name: z.string().trim().min(1).max(120).optional(),
});

const emailRecipientSchema = z.union([
  z.string().trim().email("Invalid email address"),
  emailAddressSchema,
]);

const createEmailTriggerSchema = z
  .object({
    to: z.array(emailRecipientSchema).min(1, "At least one recipient is required"),
    cc: z.array(emailRecipientSchema).optional(),
    bcc: z.array(emailRecipientSchema).optional(),
    from: emailRecipientSchema.optional(),
    replyTo: emailRecipientSchema.optional(),
    subject: z.string().trim().min(1).max(200),
    text: z.string().trim().min(1).max(20000).optional(),
    html: z.string().trim().min(1).max(50000).optional(),
    categories: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    customArgs: z.record(z.string(), z.string()).optional(),
  })
  .refine((value) => Boolean(value.text || value.html), {
    message: "Provide text or html content",
    path: ["text"],
  })
  .strict();

module.exports = { createEmailTriggerSchema };
