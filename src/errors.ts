/**
 * Error thrown by the Bonum PSP SDK when an API call fails.
 */
export class BonumError extends Error {
  /** HTTP status code (if available) */
  readonly statusCode?: number;
  /** Raw response body */
  readonly response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.name = "BonumError";
    this.statusCode = statusCode;
    this.response = response;
  }
}
