import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BonumGatewayClient } from "../src/gateway-client.js";
import { BonumError } from "../src/errors.js";
import {
  computeWebhookChecksum,
  verifyWebhookChecksum,
  parseWebhookEvent,
} from "../src/webhook.js";

const config = {
  baseUrl: "https://testapi.bonum.mn",
  appSecret: "test-app-secret",
  terminalId: "10000001",
};

const AUTH_RESPONSE = {
  tokenType: "Bearer",
  accessToken: "access-1",
  expiresIn: 1800,
  refreshToken: "refresh-1",
  refreshExpiresIn: 2000,
  unit: "SECONDS",
};

const AUTH_RESPONSE_2 = { ...AUTH_RESPONSE, accessToken: "access-2", refreshToken: "refresh-2" };

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Build a fetch mock that routes by URL; records every call. */
function routedFetch(handlers: Record<string, () => unknown>) {
  return vi.fn((url: string, init?: RequestInit) => {
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) {
        return Promise.resolve(handler.call({ url, init }) as Response);
      }
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("BonumGatewayClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("authentication", () => {
    it("logs in with AppSecret + X-TERMINAL-ID and caches the token", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/payment-providers": () => jsonResponse(["QPAY", "E_COMMERCE"]),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      await client.getPaymentProviders();
      await client.getPaymentProviders();

      const authCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/auth/create"),
      );
      // Only one auth call despite two API calls (token cached).
      expect(authCalls).toHaveLength(1);

      const authInit = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes("/auth/create"),
      )![1] as RequestInit;
      expect((authInit.headers as Record<string, string>).Authorization).toBe(
        "AppSecret test-app-secret",
      );
      expect(
        (authInit.headers as Record<string, string>)["X-TERMINAL-ID"],
      ).toBe("10000001");
    });

    it("refreshes the token after it expires", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/auth/refresh": () => jsonResponse(AUTH_RESPONSE_2),
        "/payment-providers": () => jsonResponse(["QPAY"]),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      await client.getPaymentProviders();

      // Advance past the access-token lifetime (1800s) but within refresh window.
      vi.advanceTimersByTime(1800_000);
      await client.getPaymentProviders();

      const refreshCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/auth/refresh"),
      );
      expect(refreshCalls).toHaveLength(1);
      const refreshInit = refreshCalls[0][1] as RequestInit;
      expect(
        (refreshInit.headers as Record<string, string>).Authorization,
      ).toBe("Bearer refresh-1");
    });

    it("throws BonumError on a 429 rate-limit during auth", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse({ status: 429 }, 429),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      await expect(client.getPaymentProviders()).rejects.toThrow(BonumError);
    });
  });

  describe("invoices", () => {
    it("creates an invoice", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/ecommerce/invoices": () =>
          jsonResponse({
            invoiceId: "inv-123",
            followUpLink: "https://ecommerce.bonum.mn/ecommerce?invoiceId=inv-123",
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      const res = await client.createInvoice({
        amount: 1000,
        callback: "https://example.com/webhook",
        transactionId: "ORDER-123",
        providers: ["QPAY"],
      });

      expect(res.invoiceId).toBe("inv-123");
      expect(res.followUpLink).toContain("inv-123");

      const call = fetchMock.mock.calls.find((c) =>
        String(c[0]).endsWith("/ecommerce/invoices"),
      )!;
      const init = call[1] as RequestInit;
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer access-1",
      );
      expect(JSON.parse(init.body as string)).toMatchObject({
        amount: 1000,
        transactionId: "ORDER-123",
        providers: ["QPAY"],
      });
    });
  });

  describe("card tokenization", () => {
    it("sends X-CARD-TOKEN on purchase and does not throw on a 400 decline", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/transaction/purchase": () =>
          jsonResponse({ errorCode: "FAILED" }, 400),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      const res = await client.purchaseWithCardToken({
        cardToken: "card-tok-1",
        amount: 15000,
        transactionId: "txn-1",
      });

      expect(res.httpStatus).toBe(400);
      expect(res.errorCode).toBe("FAILED");

      const call = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes("/transaction/purchase"),
      )!;
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>)["X-CARD-TOKEN"]).toBe(
        "card-tok-1",
      );
      expect(JSON.parse(init.body as string)).toMatchObject({
        amount: 15000,
        currency: "MNT",
        transactionId: "txn-1",
      });
    });

    it("throws BonumError on a 401 during purchase", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/transaction/purchase": () => jsonResponse({}, 401),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      await expect(
        client.purchaseWithCardToken({
          cardToken: "card-tok-1",
          amount: 1,
          transactionId: "txn-1",
        }),
      ).rejects.toThrow(BonumError);
    });
  });

  describe("subscriptions", () => {
    it("maps payment plans", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/payment-plans": () =>
          jsonResponse({
            data: [
              {
                planId: 1,
                name: "Weekly",
                recurringType: "WEEKLY",
                amount: 5000,
                status: "ACTIVE",
                retryCount: 3,
              },
            ],
            status: 200,
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      const plans = await client.listPaymentPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({ planId: 1, recurringType: "WEEKLY" });
    });
  });

  describe("QR", () => {
    it("unwraps the data envelope", async () => {
      const fetchMock = routedFetch({
        "/auth/create": () => jsonResponse(AUTH_RESPONSE),
        "/transaction/qr/create": () =>
          jsonResponse({
            data: {
              invoiceId: "qr-1",
              qrCode: "0002010102...",
              qrImage: "base64data",
              links: [{ name: "Khan bank", link: "khanbank://q?..." }],
            },
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const client = new BonumGatewayClient(config);
      const qr = await client.createQr({ amount: 10000, transactionId: "t1" });
      expect(qr.invoiceId).toBe("qr-1");
      expect(qr.links[0].name).toBe("Khan bank");
    });
  });
});

describe("webhook checksum", () => {
  // Known vector: HmacSHA256("{\"a\":1}", "secret-key") hex.
  const key = "secret-key";
  const rawBody = '{"a":1}';

  it("computes a stable hex digest", () => {
    const sum = computeWebhookChecksum(rawBody, key);
    expect(sum).toMatch(/^[0-9a-f]{64}$/);
    // Stable across calls.
    expect(computeWebhookChecksum(rawBody, key)).toBe(sum);
  });

  it("verifies a matching checksum and rejects a bad one", () => {
    const sum = computeWebhookChecksum(rawBody, key);
    expect(verifyWebhookChecksum(rawBody, sum, key)).toBe(true);
    expect(verifyWebhookChecksum(rawBody, "deadbeef", key)).toBe(false);
    expect(verifyWebhookChecksum(rawBody, null, key)).toBe(false);
    expect(verifyWebhookChecksum('{"a":2}', sum, key)).toBe(false);
  });

  it("parses a webhook event", () => {
    const event = parseWebhookEvent(
      '{"type":"PAYMENT","status":"SUCCESS","message":"","body":{"transactionId":"N1"}}',
    );
    expect(event.type).toBe("PAYMENT");
    expect(event.status).toBe("SUCCESS");
    expect((event.body as Record<string, unknown>).transactionId).toBe("N1");
  });
});
