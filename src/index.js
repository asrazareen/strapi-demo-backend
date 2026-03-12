"use strict";
// import type { Core } from '@strapi/strapi';

const { sendEmail } = require("./utils/sendEmail");

const sendLoginEmailWithTwilio = async (strapi, user) => {
    if (!user?.email) {
        strapi.log.warn(
            `[auth-email] skipped: missing userEmail (hasUserEmail=${!!user?.email})`
        );
        return;
    }

    try {
        await sendEmail(strapi, {
            to: user.email,
            subject: "Login Successful",
            text: `Hi ${user.username || "User"}, your login was successful.`,
            categories: ["auth-login"],
            customArgs: {
                flow: "auth-login",
                userId: String(user.id || ""),
            },
        });
    } catch (error) {
        strapi.log.error(`[auth-email] error: ${error.message}`);
    }
};

module.exports = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register( /* { strapi }: { strapi: Core.Strapi } */) { },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    bootstrap({ strapi } /* { strapi }: { strapi: Core.Strapi } */) {
        strapi.server.use(async (ctx, next) => {
            await next();

            const isLocalLogin =
                ctx.method === "POST" && ctx.path === "/api/auth/local";
            const isProviderCallback =
                ctx.method === "GET" && /^\/api\/auth\/[^/]+\/callback$/.test(ctx.path);

            if (!isLocalLogin && !isProviderCallback) {
                return;
            }

            if (ctx.status >= 400) {
                strapi.log.warn(
                    `[auth-email] skipped callback: status=${ctx.status}, path=${ctx.path}`
                );
                return;
            }

            const loggedInUser = ctx.body?.user;
            if (!loggedInUser) {
                strapi.log.warn(
                    `[auth-email] skipped callback: no user in response, path=${ctx.path}`
                );
                return;
            }

            await sendLoginEmailWithTwilio(strapi, loggedInUser);
        });
    },
};
