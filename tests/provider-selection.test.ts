import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getFootballProvider,
  getProviderRegistry,
  resetProviderRegistry,
} from "@/lib/football/providerRegistry";

describe("provider selection", () => {
  const originalEnv = process.env.FOOTBALL_DATA_PROVIDER;
  const originalShadow = process.env.FOOTBALL_DATA_PROVIDER_SHADOW;

  beforeEach(() => {
    resetProviderRegistry();
  });

  afterEach(() => {
    process.env.FOOTBALL_DATA_PROVIDER = originalEnv;
    process.env.FOOTBALL_DATA_PROVIDER_SHADOW = originalShadow;
    resetProviderRegistry();
  });

  it("selects current provider by default when FOOTBALL_DATA_PROVIDER is current", () => {
    process.env.FOOTBALL_DATA_PROVIDER = "current";
    process.env.FOOTBALL_DATA_PROVIDER_SHADOW = "none";
    resetProviderRegistry();

    const provider = getFootballProvider();
    expect(provider.name).toBe("football-api");
  });

  it("keeps api-football as an explicit backwards-compatible provider alias", () => {
    process.env.FOOTBALL_DATA_PROVIDER = "api-football";
    process.env.FOOTBALL_DATA_PROVIDER_SHADOW = "none";
    resetProviderRegistry();

    expect(getFootballProvider().name).toBe("football-api");
  });

  it("selects sportsapi provider when FOOTBALL_DATA_PROVIDER is sportsapi", () => {
    process.env.FOOTBALL_DATA_PROVIDER = "sportsapi";
    process.env.FOOTBALL_DATA_PROVIDER_SHADOW = "none";
    resetProviderRegistry();

    const provider = getFootballProvider();
    expect(provider.name).toBe("sportsapi");
  });

  it("activates shadow provider when FOOTBALL_DATA_PROVIDER_SHADOW is sportsapi", () => {
    process.env.FOOTBALL_DATA_PROVIDER = "current";
    process.env.FOOTBALL_DATA_PROVIDER_SHADOW = "sportsapi";
    resetProviderRegistry();

    const registry = getProviderRegistry();
    expect(registry.getPrimary().name).toBe("football-api");
    expect(registry.getShadow()?.name).toBe("sportsapi");
  });
});
