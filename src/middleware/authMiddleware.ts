import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "../models/user.model.js";
import { AUTH_COOKIE } from "../utils/auth-cookies.js";
import { HttpError } from "../utils/http-error.js";
import { verifyToken } from "../utils/jwt.js";

/** Rejects the request with 401 unless it carries a valid login cookie. */
const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];

  if (typeof token !== "string" || !token) {
    throw new HttpError(401, "Authentication required");
  }

  // verifyToken throws HttpError(401) for an invalid or expired token.
  const payload = verifyToken(token);
  req.user = { id: payload.userId, role: payload.role };

  next();
};

/** Use after requireAuth, e.g. router.delete("/:id", requireAuth, requireRole("admin"), handler) */
const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "You don't have permission to do this");
    }
    next();
  };
};

export { requireAuth, requireRole };
