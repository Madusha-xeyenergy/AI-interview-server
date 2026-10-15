import { toPublicUser, UserModel, type UserRole } from "../models/user.model.js";
import { HttpError } from "../utils/http-error.js";
import { signToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";

// MongoDB's error code when a unique index (here: email) is violated.
const DUPLICATE_KEY_ERROR = 11000;

function issueToken(user: { _id: { toString(): string }; role: string }) {
  return signToken({ userId: user._id.toString(), role: user.role as UserRole });
}

const registerService = async ({ name, email, password }: RegisterInput) => {
  const normalizedEmail = email.toLowerCase();

  if (await UserModel.exists({ email: normalizedEmail })) {
    throw new HttpError(409, "An account with this email already exists");
  }

  try {
    // Role is never taken from the request: self sign-up is always a recruiter.
    const user = await UserModel.create({
      name,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: "recruiter",
    });

    return { token: issueToken(user), user: toPublicUser(user) };
  } catch (err) {
    // Two sign-ups with the same email at the same moment can both pass the
    // exists() check; the unique index catches the second one.
    if ((err as { code?: number }).code === DUPLICATE_KEY_ERROR) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw err;
  }
};

const loginService = async ({ email, password }: LoginInput) => {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  // Same message for "no such email" and "wrong password", so the API
  // can't be used to discover which emails have accounts.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }

  return { token: issueToken(user), user: toPublicUser(user) };
};

const getCurrentUser = async (userId: string) => {
  const user = await UserModel.findById(userId);

  // Token is valid but the user was deleted since it was issued.
  if (!user) {
    throw new HttpError(401, "Session is no longer valid");
  }

  return toPublicUser(user);
};

export { registerService, loginService, getCurrentUser };
