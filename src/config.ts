import type { BonumConfig } from "./types.js";

/**
 * Load Bonum PSP configuration from environment variables.
 *
 * | Environment Variable | Config Field  |
 * |---------------------|---------------|
 * | BONUM_ENDPOINT      | endpoint      |
 * | BONUM_MERCHANT_KEY  | merchantKey   |
 */
export function loadConfigFromEnv(): BonumConfig {
  const endpoint = process.env.BONUM_ENDPOINT;
  const merchantKey = process.env.BONUM_MERCHANT_KEY;

  if (!endpoint) throw new Error("Missing BONUM_ENDPOINT environment variable");
  if (!merchantKey) throw new Error("Missing BONUM_MERCHANT_KEY environment variable");

  return { endpoint, merchantKey };
}
