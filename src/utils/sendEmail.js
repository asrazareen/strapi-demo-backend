"use strict";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

const toEmailAddress = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return { email: value };
  }

  if (typeof value === "object" && typeof value.email === "string") {
    const address = { email: value.email };
    if (value.name) {
      address.name = value.name;
    }
    return address;
  }

  return null;
};

const normalizeRecipients = (input) => {
  const values = Array.isArray(input) ? input : [input];

  return values.map(toEmailAddress).filter(Boolean);
};

const buildContent = ({ text, html }) => {
  const content = [];

  if (text) {
    content.push({ type: "text/plain", value: text });
  }

  if (html) {
    content.push({ type: "text/html", value: html });
  }

  return content;
};

const sendEmail = async (strapi, options = {}) => {
  const apiKey = process.env.TWILIO_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
  const defaultFrom =
    process.env.TWILIO_SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL;

  const {
    to,
    cc,
    bcc,
    from,
    replyTo,
    subject,
    text,
    html,
    categories,
    customArgs,
  } = options;

  const recipients = normalizeRecipients(to);
  const ccRecipients = normalizeRecipients(cc);
  const bccRecipients = normalizeRecipients(bcc);
  const sender = toEmailAddress(from || defaultFrom);
  const replyToAddress = toEmailAddress(replyTo);
  const content = buildContent({ text, html });

  if (!apiKey) {
    throw new Error("TWILIO_SENDGRID_API_KEY or SENDGRID_API_KEY is not configured");
  }

  if (!sender) {
    throw new Error(
      "TWILIO_SENDGRID_FROM_EMAIL or SENDGRID_FROM_EMAIL is not configured"
    );
  }

  if (!recipients.length) {
    throw new Error("At least one recipient is required");
  }

  if (!subject?.trim()) {
    throw new Error("Email subject is required");
  }

  if (!content.length) {
    throw new Error("Email content requires text or html");
  }

  const payload = {
    personalizations: [
      {
        to: recipients,
        ...(ccRecipients.length ? { cc: ccRecipients } : {}),
        ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
        ...(customArgs ? { custom_args: customArgs } : {}),
      },
    ],
    from: sender,
    subject: subject.trim(),
    content,
    ...(replyToAddress ? { reply_to: replyToAddress } : {}),
    ...(Array.isArray(categories) && categories.length ? { categories } : {}),
  };

  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendGrid request failed (${response.status}): ${details}`);
  }

  strapi.log.info(
    `[email] sent subject="${subject.trim()}" to=${recipients
      .map((recipient) => recipient.email)
      .join(",")}`
  );

  return {
    success: true,
    accepted: recipients.map((recipient) => recipient.email),
    status: response.status,
  };
};

module.exports = { sendEmail };
