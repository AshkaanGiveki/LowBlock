import { describe, expect, it } from "vitest";
import { getRandomAwardShareMessage, shareCopy } from "@/lib/awards/shareCopy";
describe("award share copy", () => { it("has the complete localized pools", () => { expect(shareCopy.fa).toHaveLength(40); expect(shareCopy.en).toHaveLength(40); }); it("returns copy from the requested locale", () => { expect(shareCopy.fa).toContain(getRandomAwardShareMessage("fa")); expect(shareCopy.en).toContain(getRandomAwardShareMessage("en")); }); });
