import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "../models/user.model.js";
import { HttpError } from "./http-error.js";

export type AuthTokenPayload = {
  userId: string;
  role: UserRole;
};

const signToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    // Same lifetime as the cookie (auth-cookies.ts), so they expire together.
    expiresIn: env.JWT_EXPIRES_IN_HOURS * 60 * 60, // seconds
  });
};

const verifyToken = (token: string): AuthTokenPayload => {
  let decoded: string | jwt.JwtPayload;

  try {
    // Pinning the algorithm stops tokens signed with a different algorithm being accepted.
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  if (typeof decoded === "string" || typeof decoded.userId !== "string" || !decoded.role) {
    throw new HttpError(401, "Invalid token payload");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };
};

export { signToken, verifyToken };
