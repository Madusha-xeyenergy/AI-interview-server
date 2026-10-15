import type { Request, Response } from "express";

import { getCurrentUser, loginService, registerService } from "../services/authService.js";
import { AUTH_COOKIE, authCookieMaxAge, authCookieOptions } from "../utils/auth-cookies.js";
import { HttpError } from "../utils/http-error.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

// The token lives only in the httpOnly cookie; it is never sent in the body.
const setAuthCookie = (res: Response, token: string) => {
  res.cookie(AUTH_COOKIE, token, {
    ...authCookieOptions,
    maxAge: authCookieMaxAge,
  });
};

// POST /api/auth/register: creates a recruiter account and logs them in.
const register = async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body); // invalid body → ZodError → 422 via error-handler
  const { token, user } = await registerService(input);

  setAuthCookie(res, token);
  res.status(201).json({ user });
};

// POST /api/auth/login
const login = async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { token, user } = await loginService(input);

  setAuthCookie(res, token);
  res.json({ user });
};

// POST /api/auth/logout
const logout = (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, authCookieOptions);
  res.json({ message: "Logged out successfully" });
};

// GET /api/auth/me: returns the logged-in user. `req.user` is set by requireAuth.
const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const user = await getCurrentUser(req.user.id);
  res.json({ user });
};

export { register, login, logout, getMe };
