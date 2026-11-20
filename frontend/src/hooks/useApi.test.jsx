
/* @vitest-environment jsdom */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { renderHook } from "@testing-library/react";
import { useApi } from "./useApi";


const { mockGetToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
}));


// Mock Clerk only in the test environment.
vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));


// Mock HTTP responses without calling FastAPI.
function mockResponse(status, data = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () =>
        data === null
          ? ""
          : "application/json",
    },
    json: async () => data,
  };
}


beforeEach(() => {
  mockGetToken.mockReset();
  mockGetToken.mockResolvedValue("test-clerk-token");

  vi.stubGlobal("fetch", vi.fn());
});


afterEach(() => {
  vi.unstubAllGlobals();
});


// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

describe("useApi authentication", () => {
  it("attaches the Clerk token to API requests", async () => {
    fetch.mockResolvedValue(
      mockResponse(200, [])
    );

    const { result } = renderHook(() => useApi());

    const data = await result.current(
      "/api/transactions"
    );

    expect(data).toEqual([]);
    expect(mockGetToken).toHaveBeenCalled();

    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, options] = fetch.mock.calls[0];

    expect(url).toContain("/api/transactions");

    expect(
      options.headers.get("Authorization")
    ).toBe("Bearer test-clerk-token");
  });


  it("rejects requests without a Clerk token", async () => {
    mockGetToken.mockResolvedValue(null);

    const { result } = renderHook(() => useApi());

    await expect(
      result.current("/api/transactions")
    ).rejects.toThrow("Please sign in again.");

    expect(fetch).not.toHaveBeenCalled();
  });
});


// --------------------------------------------------
// SUCCESSFUL API RESPONSES
// --------------------------------------------------

describe("useApi successful responses", () => {
  it("returns transaction data", async () => {
    const transactions = [
      {
        id: "abc123",
        description: "Walmart",
        amount_cents: 2500,
      },
    ];

    fetch.mockResolvedValue(
      mockResponse(200, transactions)
    );

    const { result } = renderHook(() => useApi());

    const data = await result.current(
      "/api/transactions"
    );

    expect(data).toEqual(transactions);
  });


  it("handles empty 204 responses", async () => {
    fetch.mockResolvedValue(
      mockResponse(204)
    );

    const { result } = renderHook(() => useApi());

    const data = await result.current(
      "/api/transactions/test-id",
      { method: "DELETE" }
    );

    expect(data).toBeNull();
  });
});


// --------------------------------------------------
// API ERROR HANDLING
// --------------------------------------------------

describe("useApi errors", () => {
  it("handles expired or invalid sessions", async () => {
    fetch.mockResolvedValue(
      mockResponse(401, {
        detail: "Authentication required",
      })
    );

    const { result } = renderHook(() => useApi());

    await expect(
      result.current("/api/transactions")
    ).rejects.toThrow(/session has expired/i);
  });


  it("displays Pydantic validation errors", async () => {
    fetch.mockResolvedValue(
      mockResponse(422, {
        detail: [
          {
            loc: ["body", "amount_cents"],
            msg: "Input should be greater than 0",
          },
        ],
      })
    );

    const { result } = renderHook(() => useApi());

    await expect(
      result.current("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount_cents: -100,
        }),
      })
    ).rejects.toThrow(
      /amount_cents: Input should be greater than 0/
    );
  });


  it("handles rate limiting", async () => {
    fetch.mockResolvedValue(
      mockResponse(429, {
        detail: "Too many requests. Please try again later.",
      })
    );

    const { result } = renderHook(() => useApi());

    await expect(
      result.current("/api/transactions")
    ).rejects.toThrow(/Too many requests/i);
  });


  it("handles backend connection failures", async () => {
    fetch.mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    const { result } = renderHook(() => useApi());

    await expect(
      result.current("/api/transactions")
    ).rejects.toThrow(
      /Unable to connect to SpendWise API/
    );
  });
});
