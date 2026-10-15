import { createHash, randomBytes } from "node:crypto";

/** SHA-256 of a raw invite token. Used when saving and when the candidate opens the link. */
const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a random, URL-safe invite token. Only the hash is stored, so a database
 * leak doesn't expose working interview links; the raw token lives only in the URL.
 */
const createInviteToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
};

export { createInviteToken, hashInviteToken };
