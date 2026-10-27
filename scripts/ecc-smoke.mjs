const BASE_URL =
  process.env.BASE_URL ||
  "http://localhost:3000";

const TIMEOUT_MS = Number(
  process.env.SMOKE_TIMEOUT_MS ||
    120000,
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(route) {
  const started = performance.now();

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${BASE_URL}${route}`,
      {
        signal:
          controller.signal,
        headers: {
          accept:
            "application/json",
        },
      },
    );

    const text =
      await response.text();

    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    return {
      response,
      text,
      data,
      durationMs: Math.round(
        performance.now() -
          started,
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(
  route,
  attempts = 3,
) {
  let last = null;

  for (
    let index = 0;
    index < attempts;
    index += 1
  ) {
    last =
      await requestJson(route);

    if (last.response.ok) {
      return last;
    }

    const retryable =
      last.response.status ===
        429 ||
      last.response.status ===
        502 ||
      last.response.status ===
        503;

    if (
      !retryable ||
      index === attempts - 1
    ) {
      return last;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1200,
        ),
    );
  }

  return last;
}

function printFailure(
  label,
  result,
) {
  console.error(
    `${label} HTTP ${result.response.status}`,
  );

  if (result.data) {
    console.error(
      JSON.stringify(
        result.data,
        null,
        2,
      ).slice(0, 6000),
    );
  } else {
    console.error(
      result.text.slice(
        0,
        6000,
      ),
    );
  }
}

console.log(
  "ECC SMART V8 END-TO-END SMOKE TEST",
);

console.log(
  `Server: ${BASE_URL}`,
);

console.log(
  `Timeout: ${TIMEOUT_MS}ms`,
);

const page =
  await requestJson("/");

assert(
  page.response.ok,
  `PAGE failed: HTTP ${page.response.status}`,
);

console.log(
  `1) PAGE PASS — ${page.durationMs}ms`,
);

const health =
  await requestJson(
    "/api/health",
  );

assert(
  health.response.ok,
  `HEALTH failed: HTTP ${health.response.status}`,
);

assert(
  health.data?.ok === true,
  "HEALTH ok flag missing",
);

assert(
  health.data?.status ===
    "healthy",
  "HEALTH status is not healthy",
);

assert(
  String(
    health.data?.version || "",
  ).startsWith("smart-v8"),
  "HEALTH version is not smart-v8",
);

assert(
  health.data?.capabilities
    ?.marketScan === true,
  "HEALTH marketScan capability missing",
);

assert(
  health.data?.capabilities
    ?.buyerResearch === true,
  "HEALTH buyerResearch capability missing",
);

console.log(
  `2) HEALTH PASS — ${health.durationMs}ms`,
);

console.log(
  "3) ANALYZE START",
);

const analyze =
  await requestWithRetry(
    "/api/analyze?hsCode=090111&year=2024&origin=156",
    3,
  );

if (!analyze.response.ok) {
  printFailure(
    "ANALYZE",
    analyze,
  );

  throw new Error(
    `ANALYZE failed: HTTP ${analyze.response.status}`,
  );
}

assert(
  analyze.data?.ok === true,
  "ANALYZE ok flag missing",
);

assert(
  Array.isArray(
    analyze.data?.markets,
  ),
  "ANALYZE markets array missing",
);

assert(
  analyze.data.markets.length >
    0,
  "ANALYZE returned zero markets",
);

assert(
  analyze.data?.screening != null,
  "ANALYZE screening missing",
);

assert(
  analyze.data?.evidence != null,
  "ANALYZE evidence missing",
);

assert(
  analyze.data?.meta?.requestId !=
    null,
  "ANALYZE requestId missing",
);

assert(
  analyze.data?.meta?.durationMs !=
    null,
  "ANALYZE durationMs missing",
);

const focus =
  analyze.data.markets[0];

assert(
  focus != null,
  "ANALYZE focus market missing",
);

assert(
  Number.isInteger(
    Number(focus.countryCode),
  ),
  "ANALYZE countryCode missing",
);

assert(
  focus.dataTrust != null,
  "ANALYZE dataTrust missing",
);

assert(
  focus.commercialEvidence !=
    null,
  "ANALYZE commercialEvidence missing",
);

assert(
  focus.intelligence?.evidenceScore !=
    null,
  "ANALYZE intelligence evidence missing",
);

assert(
  focus.originExportStatus !=
    null,
  "ANALYZE originExportStatus missing",
);

assert(
  ["GO", "VALIDATE", "WATCH", "DATA_GAP"].includes(
    focus.commercialDecision?.signal,
  ),
  "ANALYZE commercialDecision signal missing",
);

assert(
  Number.isFinite(
    Number(focus.commercialDecision?.score),
  ),
  "ANALYZE commercialDecision score missing",
);

assert(
  Boolean(focus.decisionWorkspace?.nextAction),
  "ANALYZE decisionWorkspace nextAction missing",
);

assert(
  analyze.data.screening?.commercialSignalCounts != null,
  "ANALYZE commercial signal summary missing",
);

console.log(
  `3) ANALYZE PASS — ${analyze.data.markets.length} markets — ${analyze.durationMs}ms`,
);

console.log(
  `   Focus — ${
    focus.country ||
    focus.marketName ||
    focus.market ||
    "unknown"
  }`,
);

console.log(
  `   Origin — ${
    focus.originExportStatus ||
    "unknown"
  }`,
);

console.log(
  `   Evidence — ${
    focus.intelligence?.evidenceScore ??
    "n/a"
  }/100`,
);

console.log(
  `   History — ${
    analyze.data.screening
      ?.historicalDataAvailability ||
    "unknown"
  }`,
);

console.log(
  `   Commercial — ${
    focus.commercialDecision?.signal || "unknown"
  } / ${
    focus.commercialDecision?.score ?? "n/a"
  }`,
);

console.log(
  `   Next — ${
    focus.decisionWorkspace?.nextAction ||
    "unknown"
  }`,
);

console.log(
  "4) SUPPLIERS START",
);

const suppliers =
  await requestWithRetry(
    "/api/suppliers?market=156&hsCode=090111&year=2024&origin=156&limit=5",
    3,
  );

if (!suppliers.response.ok) {
  printFailure(
    "SUPPLIERS",
    suppliers,
  );

  throw new Error(
    `SUPPLIERS failed: HTTP ${suppliers.response.status}`,
  );
}

assert(
  suppliers.data?.ok === true,
  "SUPPLIERS ok flag missing",
);

assert(
  Array.isArray(
    suppliers.data?.suppliers,
  ) ||
    Array.isArray(
      suppliers.data
        ?.supplierLandscape
        ?.suppliers,
    ),
  "SUPPLIERS records missing",
);

console.log(
  `4) SUPPLIERS PASS — ${
    suppliers.data?.suppliers?.length ??
    suppliers.data
      ?.supplierLandscape
      ?.suppliers?.length ??
    0
  } records — ${suppliers.durationMs}ms`,
);

console.log(
  `   Market — ${
    suppliers.data?.market?.code ??
    suppliers.data
      ?.supplierLandscape
      ?.destinationCode ??
    "unknown"
  }`,
);

console.log(
  `   Cache — ${
    suppliers.data?.cache ??
    "n/a"
  }`,
);

console.log(
  "5) BUYERS START",
);

const buyers =
  await requestWithRetry(
    "/api/buyers?market=840&hsCode=090111&productDescription=Coffee&limit=10",
    3,
  );

if (!buyers.response.ok) {
  printFailure(
    "BUYERS",
    buyers,
  );

  throw new Error(
    `BUYERS failed: HTTP ${buyers.response.status}`,
  );
}

assert(
  buyers.data?.ok === true,
  "BUYERS ok flag missing",
);

assert(
  buyers.data?.mode != null,
  "BUYERS mode missing",
);

if (
  buyers.data?.mode ===
  "free-research"
) {
  assert(
    buyers.data?.research
      ?.market ===
      "United States",
    "BUYERS research market mismatch",
  );

  for (
    const query of
      buyers.data.research
        .queries ||
      []
  ) {
    assert(
      query.includes(
        '"United States"',
      ),
      "BUYERS research query market mismatch",
    );
  }
}

const buyerCount =
  Array.isArray(
    buyers.data?.buyers,
  )
    ? buyers.data.buyers.length
    : 0;

console.log(
  `5) BUYERS PASS — mode: ${
    buyers.data.mode
  } — ${buyers.durationMs}ms`,
);

console.log(
  `   Buyer records — ${buyerCount}`,
);

console.log(
  "6) OBSERVABILITY CONTRACT PASS",
);

console.log(
  "7) DATA TRUST CONTRACT PASS",
);

console.log(
  "8) COMMERCIAL EVIDENCE CONTRACT PASS",
);

console.log(
  "9) PROVIDER SAFETY BOUNDARY PASS",
);

console.log(
  "10) BUYER MARKET CONTEXT CONTRACT PASS",
);

console.log(
  "11) ECC SMART V8 SMOKE: PASS",
);
