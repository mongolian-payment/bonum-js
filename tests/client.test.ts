import { describe, it, expect, vi, beforeEach } from "vitest";
import { BonumClient } from "../src/client.js";
import { BonumError } from "../src/errors.js";

const mockConfig = {
  endpoint: "https://testpsp.bonum.mn",
  merchantKey: "test-merchant-key",
};

describe("BonumClient", () => {
  let client: BonumClient;

  beforeEach(() => {
    client = new BonumClient(mockConfig);
    vi.restoreAllMocks();
  });

  describe("processPayment", () => {
    it("should process a payment successfully", async () => {
      const mockResponse = {
        success: true,
        status_code: "000",
        orderId: "ORDER-001",
        desc: "Approved",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const result = await client.processPayment({
        token: "test-token",
        orderId: "ORDER-001",
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe("000");
      expect(result.orderId).toBe("ORDER-001");
      expect(result.desc).toBe("Approved");

      expect(fetch).toHaveBeenCalledWith(
        "https://testpsp.bonum.mn/api/payment/process",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-merchant-key": "test-merchant-key",
          }),
        }),
      );
    });

    it("should throw BonumError on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ error: "Unauthorized" }),
        }),
      );

      await expect(
        client.processPayment({ token: "bad-token", orderId: "ORDER-001" }),
      ).rejects.toThrow(BonumError);
    });
  });

  describe("processGooglePay", () => {
    it("should process a Google Pay payment", async () => {
      const mockResponse = {
        success: true,
        status_code: "000",
        orderId: "ORDER-002",
        desc: "Approved",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const result = await client.processGooglePay({
        token: "google-pay-token",
        orderId: "ORDER-002",
        amount: 5000,
        currencyCode: "MNT",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("ORDER-002");

      expect(fetch).toHaveBeenCalledWith(
        "https://testpsp.bonum.mn/api/payment/process/google",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("validateMerchant", () => {
    it("should validate merchant session", async () => {
      const mockSession = { merchantSession: "data" };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockSession),
        }),
      );

      const result = await client.validateMerchant({
        validationURL: "https://apple-pay-gateway.apple.com/paymentservices/startSession",
      });

      expect(result).toEqual(mockSession);

      expect(fetch).toHaveBeenCalledWith(
        "https://testpsp.bonum.mn/api/merchant/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("getPaymentLog", () => {
    it("should get payment log entries", async () => {
      const mockResponse = [
        {
          merchant_order_id: "ORDER-001",
          amount: 5000,
          success: true,
          createdAt: "2025-01-24T03:22:03.135Z",
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const logs = await client.getPaymentLog("ORDER-001");

      expect(logs).toHaveLength(1);
      expect(logs[0].merchantOrderId).toBe("ORDER-001");
      expect(logs[0].amount).toBe(5000);
      expect(logs[0].success).toBe(true);

      expect(fetch).toHaveBeenCalledWith(
        "https://testpsp.bonum.mn/api/payment-log/read?order_id=ORDER-001",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
