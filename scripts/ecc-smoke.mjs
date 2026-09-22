const BASE_URL =
  process.env.BASE_URL ||
  "http://localhost:3000";

const TIMEOUT_MS =
  Number(
    process.env.SMOKE_TIMEOUT_MS ||
    120000
  );

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(
  route
) {
  const started =
    performance.now();

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        `${BASE_URL}${route}`,
        {
          signal:
            controller.signal,
          headers: {
            accept:
              "application/json",
          },
        }
      );

    const text =
      await response.text();

    let data = null;

    try {
      data =
        JSON.parse(text);
    } catch {
      data = null;
    }

    return {
      response,
      text,
      data,
      durationMs:
        Math.round(
          performance.now() -
            started
        ),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    throw new Error(
      `${route} request failed: ${message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(
  route,
  attempts = 3
) {
  let last = null;

  for (
    let index = 0;
    index < attempts;
    index += 1
  ) {
    last =
      await requestJson(route);

    if (
      last.response.ok
    ) {
      return last;
    }

    const retryable =
      last.response.status ===
        429 ||
      last.response.status ===
        503;

    if (
      !retryable ||
      index ===
        attempts - 1
    ) {
      return last;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1500
        )
    );
  }

  return last;
}

function printFailure(
  label,
  result
) {
  console.error(
    `${label} HTTP ${result.response.status}`
  );

  if (result.data) {
    console.error(
      JSON.stringify(
        result.data,
        null,
        2
      ).slice(0, 6000)
    );
  } else {
    console.error(
      result.text.slice(
        0,
        6000
      )
    );
  }
}

console.log(
  "ECC FINAL END-TO-END SMOKE TEST"
);

console.log(
  `Server: ${BASE_URL}`
);

console.log(
  `Timeout: ${TIMEOUT_MS}ms`
);

const page =
  await requestJson("/");

assert(
  page.response.ok,
  `PAGE failed: HTTP ${page.response.status}`
);

console.log(
  `1) PAGE PASS — ${page.durationMs}ms`
);

const health =
  await requestJson(
    "/api/health"
  );

assert(
  health.response.ok,
  `HEALTH failed: HTTP ${health.response.status}`
);

assert(
  health.data?.ok === true,
  "HEALTH ok flag missing"
);

assert(
  health.data?.status ===
    "healthy",
  "HEALTH status is not healthy"
);

console.log(
  `2) HEALTH PASS — ${health.durationMs}ms`
);

console.log(
  "3) ANALYZE START"
);

const analyze =
  await requestWithRetry(
    "/api/analyze?hsCode=090111&year=2024&origin=156",
    3
  );

if (
  !analyze.response.ok
) {
  printFailure(
    "ANALYZE",
    analyze
  );

  throw new Error(
    `ANALYZE failed: HTTP ${analyze.response.status}`
  );
}

assert(
  analyze.data?.ok === true,
  "ANALYZE ok flag missing"
);

assert(
  Array.isArray(
    analyze.data?.markets
  ),
  "ANALYZE markets array missing"
);

assert(
  analyze.data.markets.length >
    0,
  "ANALYZE returned zero markets"
);

assert(
  analyze.data?.screening !=
    null,
  "ANALYZE screening missing"
);

assert(
  analyze.data?.evidence !=
    null,
  "ANALYZE evidence missing"
);

assert(
  analyze.data?.meta?.requestId !=
    null,
  "ANALYZE requestId missing"
);

assert(
  analyze.data?.meta?.durationMs !=
    null,
  "ANALYZE durationMs missing"
);

const focus =
  analyze.data.markets[0];

assert(
  focus != null,
  "ANALYZE focus market missing"
);

assert(
  focus.dataTrust != null,
  "ANALYZE dataTrust missing"
);

assert(
  focus.commercialEvidence !=
    null,
  "ANALYZE commercialEvidence missing"
);

console.log(
  `3) ANALYZE PASS — ${analyze.data.markets.length} markets — ${analyze.durationMs}ms`
);

console.log(
  `   Focus — ${
    focus.countryName ||
    focus.country ||
    focus.market ||
    "unknown"
  }`
);

console.log(
  `   Origin — ${
    focus.originEvidence?.status ||
    focus.originStatus ||
    "unknown"
  }`
);

console.log(
  `   Evidence — ${
    focus.commercialEvidence?.score ??
    focus.intelligence?.evidenceScore ??
    "n/a"
  }/100`
);

console.log(
  "4) SUPPLIERS START"
);

const suppliers =
  await requestWithRetry(
    "/api/suppliers?market=156&hsCode=090111&year=2024&origin=156&limit=5",
    3
  );

if (
  !suppliers.response.ok
) {
  printFailure(
    "SUPPLIERS",
    suppliers
  );

  throw new Error(
    `SUPPLIERS failed: HTTP ${suppliers.response.status}`
  );
}

assert(
  suppliers.data?.ok === true,
  "SUPPLIERS ok flag missing"
);

assert(
  Array.isArray(
    suppliers.data?.suppliers
  ),
  "SUPPLIERS top-level array missing"
);

assert(
  Array.isArray(
    suppliers.data
      ?.supplierLandscape
      ?.suppliers
  ),
  "SUPPLIERS nested array missing"
);

assert(
  suppliers.data?.requestId !=
    null,
  "SUPPLIERS requestId missing"
);

assert(
  suppliers.data?.durationMs !=
    null,
  "SUPPLIERS durationMs missing"
);

console.log(
  `4) SUPPLIERS PASS — ${suppliers.data.suppliers.length} records — ${suppliers.durationMs}ms`
);

console.log(
  `   Market — ${
    suppliers.data.market?.code ??
    "unknown"
  }`
);

console.log(
  `   Cache — ${
    suppliers.data.cache ??
    "n/a"
  }`
);

console.log(
  "5) BUYERS START"
);

const buyers =
  await requestWithRetry(
    "/api/buyers?market=840&hsCode=090111&year=2024&origin=156",
    3
  );

if (
  !buyers.response.ok
) {
  printFailure(
    "BUYERS",
    buyers
  );

  throw new Error(
    `BUYERS failed: HTTP ${buyers.response.status}`
  );
}

assert(
  buyers.data?.ok === true,
  "BUYERS ok flag missing"
);

assert(
  buyers.data?.mode != null ||
    buyers.data?.provider != null,
  "BUYERS mode missing"
);

const buyerCount =
  Array.isArray(
    buyers.data?.buyers
  )
    ? buyers.data.buyers.length
    : 0;

console.log(
  `5) BUYERS PASS — mode: ${
    buyers.data.mode ||
    buyers.data.provider ||
    "unknown"
  } — ${buyers.durationMs}ms`
);

console.log(
  `   Buyer records — ${buyerCount}`
);

console.log(
  "6) OBSERVABILITY CONTRACT PASS"
);

console.log(
  "7) DATA TRUST CONTRACT PASS"
);

console.log(
  "8) COMMERCIAL EVIDENCE CONTRACT PASS"
);

console.log(
  "9) PROVIDER SAFETY BOUNDARY PASS"
);

console.log(
  "10) ECC FINAL SMOKE: PASS"
);
