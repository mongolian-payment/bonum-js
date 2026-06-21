import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookEvent } from "./gateway-types.js";

/**
 * Compute the Bonum webhook checksum for a raw request body.
 *
 * Bonum signs webhook deliveries with `HmacSHA256(rawBody, checksumKey)`,
 * hex-encoded, where `rawBody` is the compact (no whitespace) JSON exactly as
 * sent. Compute the checksum over the raw bytes you received — do not
 * re-serialize the parsed object, as key ordering / spacing may differ.
 *
 * @param rawBody - The raw request body string as received.
 * @param checksumKey - Your `MERCHANT_CHECKSUM_KEY`.
 * @returns Lowercase hex HMAC-SHA256 digest.
 */
export function computeWebhookChecksum(
  rawBody: string,
  checksumKey: string,
): string {
  return createHmac("sha256", checksumKey).update(rawBody, "utf8").digest("hex");
}

/**
 * Verify an incoming Bonum webhook against its `x-checksum-v2` header.
 *
 * Uses a constant-time comparison to avoid timing attacks.
 *
 * @param rawBody - The raw request body string as received.
 * @param checksumHeader - The `x-checksum-v2` header value.
 * @param checksumKey - Your `MERCHANT_CHECKSUM_KEY`.
 * @returns `true` if the checksum matches.
 */
export function verifyWebhookChecksum(
  rawBody: string,
  checksumHeader: string | null | undefined,
  checksumKey: string,
): boolean {
  if (!checksumHeader) return false;

  const expected = computeWebhookChecksum(rawBody, checksumKey);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(checksumHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parse a verified webhook body into a typed {@link WebhookEvent}.
 *
 * This does NOT verify the checksum — call {@link verifyWebhookChecksum} first.
 *
 * @param rawBody - The raw request body string.
 * @returns The parsed event.
 */
export function parseWebhookEvent<TBody = Record<string, unknown>>(
  rawBody: string,
): WebhookEvent<TBody> {
  return JSON.parse(rawBody) as WebhookEvent<TBody>;
}
