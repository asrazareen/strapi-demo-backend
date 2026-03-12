"use strict";

const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const generateSlots = async (strapi, service, options = {}) => {
    const { id, start_time, end_time, duration } = service;
    const daysOpen = Array.isArray(service.days_open) ? service.days_open : [];
    const daysAhead = Number(options.daysAhead || 7);
    const startDateInput = options.startDate ? new Date(options.startDate) : new Date();

    if (
        !id ||
        !start_time ||
        !end_time ||
        !duration ||
        !daysOpen.length ||
        Number.isNaN(startDateInput.getTime())
    ) {
        return 0;
    }

    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const openDaysNumbers = daysOpen
        .map((d) => dayMap[String(d).toLowerCase()])
        .filter((d) => typeof d === "number");

    if (!openDaysNumbers.length) {
        return 0;
    }

    const timeToMinutes = (time) => {
        const [hrs, mins] = String(time).split(":").map(Number);
        return hrs * 60 + mins;
    };

    const minutesToTime = (mins) => {
        const hrs = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(hrs).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000`;
    };

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setFullYear(
        startDateInput.getFullYear(),
        startDateInput.getMonth(),
        startDateInput.getDate()
    );

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (daysAhead - 1));

    const startMinutes = timeToMinutes(start_time);
    const endMinutes = timeToMinutes(end_time);
    const slotDuration = Number(duration);
    if (slotDuration <= 0 || startMinutes >= endMinutes) {
        return 0;
    }

    const rangeStart = formatDateLocal(startDate);
    const rangeEnd = formatDateLocal(endDate);

    const existing = await strapi.entityService.findMany(
        "api::availability.availability",
        {
            fields: ["date", "start_time"],
            filters: {
                service: id,
                date: { $gte: rangeStart, $lte: rangeEnd },
            },
            pagination: { pageSize: 10000, page: 1 },
        }
    );
    const existingKeys = new Set(
        (existing || []).map((s) => `${s.date}|${String(s.start_time).slice(0, 5)}`)
    );

    let createdCount = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (!openDaysNumbers.includes(d.getDay())) continue;

        const dateStr = formatDateLocal(d);
        let current = startMinutes;
        while (current + slotDuration <= endMinutes) {
            const startAt = minutesToTime(current);
            const key = `${dateStr}|${startAt.slice(0, 5)}`;
            if (existingKeys.has(key)) {
                current += slotDuration;
                continue;
            }

            await strapi.entityService.create("api::availability.availability", {
                data: {
                    date: dateStr,
                    start_time: startAt,
                    end_time: minutesToTime(current + slotDuration),
                    is_booked: false,
                    service: id,
                },
            });
            existingKeys.add(key);
            createdCount += 1;
            current += slotDuration;
        }
    }

    return createdCount;
};

module.exports = { generateSlots };
