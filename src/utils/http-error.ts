/** Throw this from any route or service to send a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}
