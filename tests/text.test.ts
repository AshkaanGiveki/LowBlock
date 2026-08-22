import { describe, expect, it } from "vitest";
import { readableFa } from "@/lib/text";

describe("Persian copy recovery", () => {
  it("repairs legacy UTF-8/Windows-1252 mojibake", () => {
    expect(readableFa("Ø³Ù„Ø§Ù…")).toBe("سلام");
    expect(readableFa("â€”")).toBe("—");
  });
});
