export type ProviderMode =
  | "free-research"
  | "provider"
  | "unavailable";

export interface ProviderBoundary {
  mode: ProviderMode;
  paidEnabled: boolean;
  fallback: boolean;
  reason?: string;
}

export function resolveProviderBoundary(input: {
  paidEnabled: boolean;
  providerAvailable: boolean;
  providerError?: string;
}): ProviderBoundary {
  if (
    input.paidEnabled &&
    input.providerAvailable
  ) {
    return {
      mode: "provider",
      paidEnabled: true,
      fallback: false,
    };
  }

  if (
    input.paidEnabled &&
    !input.providerAvailable
  ) {
    return {
      mode: "free-research",
      paidEnabled: true,
      fallback: true,
      reason:
        input.providerError ||
        "Configured provider unavailable; using free research.",
    };
  }

  return {
    mode: "free-research",
    paidEnabled: false,
    fallback: false,
  };
}
