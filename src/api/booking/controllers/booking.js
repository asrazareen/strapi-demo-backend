"use strict";
const strapi_1 = require("@strapi/strapi");
const json2csv_1 = require("json2csv");

const toIdFilter = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

module.exports = strapi_1.factories.createCoreController(
  "api::booking.booking",
  ({ strapi }) => ({
    async find(ctx) {
      if (!ctx.query.sort) {
        ctx.query.sort = ["createdAt:desc"];
      }
      return await super.find(ctx);
    },

    async create(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Login required");
      }

      const payload = ctx.request.body?.data || {};
      const { availability, service } = payload;

      if (!availability) {
        return ctx.badRequest("availability is required");
      }

      const slot = await strapi.entityService.findOne(
        "api::availability.availability",
        availability,
        { populate: ["service"] }
      );

      if (!slot) {
        return ctx.badRequest("Availability slot not found");
      }

      if (slot.is_booked) {
        return ctx.badRequest("Slot already booked");
      }

      const slotServiceId =
        typeof slot.service === "object" ? slot.service?.id : slot.service;

      if (!slotServiceId) {
        return ctx.badRequest("Selected availability has no linked service");
      }

      if (service && Number(service) !== Number(slotServiceId)) {
        return ctx.badRequest("Service does not match selected availability");
      }

      // Enforce booking ownership from authenticated user and derive identity fields from user profile.
      ctx.request.body.data = {
        ...payload,
        user: user.id,
        service: slotServiceId,
        customer_name: payload.customer_name || user.username || "",
        customer_email: payload.customer_email || user.email || "",
      };

      const response = await super.create(ctx);

      await strapi.entityService.update(
        "api::availability.availability",
        availability,
        {
          data: { is_booked: true },
        }
      );

      return response;
    },

    async cancel(ctx) {
      const { id } = ctx.params;
      const booking = await strapi.entityService.findOne(
        "api::booking.booking",
        id,
        { populate: ["availability"] }
      );

      if (!booking) {
        return ctx.notFound("Booking not found");
      }

      await strapi.entityService.update(
        "api::availability.availability",
        booking.availability.id,
        {
          data: { is_booked: false },
        }
      );

      return await strapi.entityService.delete("api::booking.booking", id);
    },

    async myBookings(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Login required");
      }

      const bookings = await strapi.entityService.findMany(
        "api::booking.booking",
        {
          filters: {
            user: { id: user.id },
          },
          sort: ["createdAt:desc"],
          populate: ["service", "availability"],
        }
      );

      ctx.body = { data: bookings };
    },

    // EXPORT BOOKINGS + NON-BOOKED SLOTS REPORT
    async exportBookings(ctx) {
      const { service, business, user, date_from, date_to } = ctx.query;
      const slotStatus = String(ctx.query.slot_status || "both").toLowerCase();

      const includeBooked = slotStatus === "both" || slotStatus === "booked";
      const includeNonBooked =
        slotStatus === "both" ||
        slotStatus === "nonbooked" ||
        slotStatus === "unbooked" ||
        slotStatus === "available";

      const dateFilter = {};
      if (date_from) dateFilter.$gte = date_from;
      if (date_to) dateFilter.$lte = date_to;

      const serviceFilter = service ? { id: toIdFilter(service) } : undefined;
      const businessFilter = business ? { id: toIdFilter(business) } : undefined;
      const userFilter = user ? { id: toIdFilter(user) } : undefined;

      const bookedFilters = {};
      if (serviceFilter || businessFilter) {
        bookedFilters.service = {
          ...(serviceFilter || {}),
          ...(businessFilter ? { business: businessFilter } : {}),
        };
      }
      if (userFilter) {
        bookedFilters.user = userFilter;
      }
      if (Object.keys(dateFilter).length) {
        bookedFilters.availability = {
          date: dateFilter,
        };
      }

      const availabilityFilters = {
        is_booked: false,
      };
      if (serviceFilter || businessFilter) {
        availabilityFilters.service = {
          ...(serviceFilter || {}),
          ...(businessFilter ? { business: businessFilter } : {}),
        };
      }
      if (Object.keys(dateFilter).length) {
        availabilityFilters.date = dateFilter;
      }

      const [bookings, nonBookedSlots] = await Promise.all([
        includeBooked
          ? strapi.entityService.findMany("api::booking.booking", {
              filters: bookedFilters,
              populate: ["service.business", "availability", "user"],
            })
          : Promise.resolve([]),
        // If user filter is provided, non-booked slots are not user-bound; skip them.
        includeNonBooked && !userFilter
          ? strapi.entityService.findMany("api::availability.availability", {
              filters: availabilityFilters,
              populate: ["service.business"],
            })
          : Promise.resolve([]),
      ]);

      const bookedRows = (bookings || []).map((booking) => ({
        BookingID: booking.id || booking.documentId || "",
        Business: booking.service?.business?.name || "",
        Service: booking.service?.name || "",
        Date: booking.availability?.date || "",
        StartTime: booking.availability?.start_time || "",
        EndTime: booking.availability?.end_time || "",
        Customer: booking.customer_name || booking.user?.username || "",
        Email: booking.customer_email || booking.user?.email || "",
        BookingStatus: booking.booking_status || "",
        SlotStatus: "booked",
        BookedAt: booking.createdAt || booking.booking_time || "",
      }));

      const nonBookedRows = (nonBookedSlots || []).map((slot) => ({
        BookingID: "",
        Business: slot.service?.business?.name || "",
        Service: slot.service?.name || "",
        Date: slot.date || "",
        StartTime: slot.start_time || "",
        EndTime: slot.end_time || "",
        Customer: "",
        Email: "",
        BookingStatus: "",
        SlotStatus: "non-booked",
        BookedAt: "",
      }));

      const report = [...bookedRows, ...nonBookedRows].sort((a, b) => {
        const aKey = `${a.Date || ""} ${a.StartTime || ""}`;
        const bKey = `${b.Date || ""} ${b.StartTime || ""}`;
        return aKey.localeCompare(bKey);
      });

      const fields = [
        { label: "Booking ID", value: "BookingID" },
        { label: "Business", value: "Business" },
        { label: "Service", value: "Service" },
        { label: "Date", value: "Date" },
        { label: "Start Time", value: "StartTime" },
        { label: "End Time", value: "EndTime" },
        { label: "Customer", value: "Customer" },
        { label: "Email", value: "Email" },
        { label: "Booking Status", value: "BookingStatus" },
        { label: "Slot Status", value: "SlotStatus" },
        { label: "Booked At", value: "BookedAt" },
      ];

      const parser = new json2csv_1.Parser({ fields });
      const csv = parser.parse(report);

      ctx.set("Content-Type", "text/csv");
      ctx.set("Content-Disposition", "attachment; filename=booking-report.csv");
      ctx.body = csv;
    },
  })
);
