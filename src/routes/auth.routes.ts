import { Router } from "express";

import { getMe, login, logout, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, getMe); // requireAuth runs first and sets req.user

export { authRouter };
