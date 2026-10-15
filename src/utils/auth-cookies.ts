import { CookieOptions } from "express";
import { env } from "../config/env.js";


export const AUTH_COOKIE = "access_token";

export const  authCookieOptions : CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
};

export const authCookieMaxAge = env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds

