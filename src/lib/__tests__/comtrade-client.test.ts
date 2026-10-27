import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  clearComtradeCache,
  ComtradeRateLimitError,
  fetchComtradeJson,
  getComtradeCacheStats,
} from "../comtrade-client";

describe("comtrade client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearComtradeCache();
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


  it("caches successful responses within the cache window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ reporterCode: 840 }],
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

    const url =
      "https://example.test/comtrade-cache";

    await fetchComtradeJson(url, {
      minIntervalMs: 0,
      maxRetries: 0,
    });

    await fetchComtradeJson(url, {
      minIntervalMs: 0,
      maxRetries: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getComtradeCacheStats().entries).toBe(1);
  });

  it("deduplicates concurrent identical requests", async () => {
    let resolveFetch!: (
      response: Response
    ) => void;

    const pending = new Promise<Response>(
      (resolve) => {
        resolveFetch = resolve;
      },
    );

    const fetchMock = vi
      .fn()
      .mockReturnValue(pending);

    vi.stubGlobal("fetch", fetchMock);

    const url =
      "https://example.test/comtrade-dedupe";

    const first =
      fetchComtradeJson(url, {
        minIntervalMs: 0,
        maxRetries: 0,
      });

    const second =
      fetchComtradeJson(url, {
        minIntervalMs: 0,
        maxRetries: 0,
      });

    resolveFetch(
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

    const [a, b] = await Promise.all([
      first,
      second,
    ]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
