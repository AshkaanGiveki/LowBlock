import { env } from "@/lib/env";
import type { FootballDataProvider, ProviderName } from "./types";
import { CurrentFootballProvider } from "./current/provider";
import { SportsApiFootballProvider } from "./sportsapi/provider";

export class ProviderRegistry {
  private primary: FootballDataProvider;
  private shadow: FootballDataProvider | null = null;
  private providerName: ProviderName;

  constructor(providerOverride?: ProviderName, shadowOverride?: string) {
    const active =
      providerOverride ??
      (process.env.FOOTBALL_DATA_PROVIDER as ProviderName | undefined) ??
      env.FOOTBALL_DATA_PROVIDER;

    const shadow =
      shadowOverride ??
      process.env.FOOTBALL_DATA_PROVIDER_SHADOW ??
      env.FOOTBALL_DATA_PROVIDER_SHADOW;

    this.providerName = active === "sportsapi" ? "sportsapi" : "football-api";

    this.primary =
      this.providerName === "sportsapi"
        ? new SportsApiFootballProvider()
        : new CurrentFootballProvider();

    if (shadow === "sportsapi" && this.primary.name !== "sportsapi") {
      this.shadow = new SportsApiFootballProvider();
    }
  }

  getPrimary(): FootballDataProvider {
    return this.primary;
  }

  getShadow(): FootballDataProvider | null {
    return this.shadow;
  }
}

// Global registry holder
const globalForRegistry = globalThis as unknown as {
  providerRegistry?: ProviderRegistry;
  lastProviderConfig?: string;
};

export function getProviderRegistry(): ProviderRegistry {
  const currentConfig = `${process.env.FOOTBALL_DATA_PROVIDER || env.FOOTBALL_DATA_PROVIDER}:${process.env.FOOTBALL_DATA_PROVIDER_SHADOW || env.FOOTBALL_DATA_PROVIDER_SHADOW}`;

  if (
    !globalForRegistry.providerRegistry ||
    globalForRegistry.lastProviderConfig !== currentConfig
  ) {
    globalForRegistry.providerRegistry = new ProviderRegistry();
    globalForRegistry.lastProviderConfig = currentConfig;
  }
  return globalForRegistry.providerRegistry;
}

/**
 * Convenience function to get the active primary provider.
 */
export function getFootballProvider(): FootballDataProvider {
  return getProviderRegistry().getPrimary();
}

/**
 * Resets the provider registry singleton (useful for testing and reconfig).
 */
export function resetProviderRegistry(): void {
  globalForRegistry.providerRegistry = undefined;
  globalForRegistry.lastProviderConfig = undefined;
}
