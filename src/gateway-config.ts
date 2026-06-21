import type { BonumGatewayConfig } from "./gateway-types.js";

/**
 * Load Bonum Gateway configuration from environment variables.
 *
 * | Environment Variable          | Config Field   | Required |
 * |-------------------------------|----------------|----------|
 * | BONUM_GATEWAY_BASE_URL        | baseUrl        | yes      |
 * | BONUM_APP_SECRET              | appSecret      | yes      |
 * | BONUM_TERMINAL_ID             | terminalId     | yes      |
 * | BONUM_MERCHANT_CHECKSUM_KEY   | checksumKey    | no       |
 * | BONUM_ACCEPT_LANGUAGE         | acceptLanguage | no       |
 *
 * Secrets must never be hard-coded — always supply them via the environment
 * or a secrets vault.
 *
 * @throws {Error} If any required variable is missing.
 */
export function loadGatewayConfigFromEnv(): BonumGatewayConfig {
  const baseUrl = process.env.BONUM_GATEWAY_BASE_URL;
  const appSecret = process.env.BONUM_APP_SECRET;
  const terminalId = process.env.BONUM_TERMINAL_ID;
  const checksumKey = process.env.BONUM_MERCHANT_CHECKSUM_KEY;
  const acceptLanguage = process.env.BONUM_ACCEPT_LANGUAGE;

  if (!baseUrl)
    throw new Error("Missing BONUM_GATEWAY_BASE_URL environment variable");
  if (!appSecret)
    throw new Error("Missing BONUM_APP_SECRET environment variable");
  if (!terminalId)
    throw new Error("Missing BONUM_TERMINAL_ID environment variable");

  const config: BonumGatewayConfig = { baseUrl, appSecret, terminalId };
  if (checksumKey) config.checksumKey = checksumKey;
  if (acceptLanguage === "mn" || acceptLanguage === "en") {
    config.acceptLanguage = acceptLanguage;
  }

  return config;
}
