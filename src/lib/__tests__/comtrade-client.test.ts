import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ComtradeRateLimitError,
  fetchComtradeJson,
} from "../comtrade-client";

describe("comtrade client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a 429 response using backoff and succeeds", async () => {
    const fetchMock = vi.fn();

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Too Many Requests",
          }),
          {
            status: 429,
            headers: {
              "retry-after": "0",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ reporterCode: 276 }],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchComtradeJson<{
      data: Array<{ reporterCode: number }>;
    }>(
      "https://example.test/comtrade",
      {
        minIntervalMs: 0,
        maxRetries: 1,
        backoffBaseMs: 0,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data[0]?.reporterCode).toBe(276);
  });

  it("surfaces a rate-limit error after retries are exhausted", async () => {
    const fetchMock = vi.fn();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Too Many Requests",
        }),
        {
          status: 429,
          headers: {
            "retry-after": "2",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchComtradeJson(
        "https://example.test/comtrade",
        {
          minIntervalMs: 0,
          maxRetries: 1,
          backoffBaseMs: 0,
        },
      ),
    ).rejects.toBeInstanceOf(ComtradeRateLimitError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
