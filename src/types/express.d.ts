import type { UserRole } from "../models/user.model.js";

// Adds `req.user` (set by the requireAuth middleware) to Express's Request type.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

export {};
