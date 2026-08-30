import { describe, expect, it } from "vitest";
import { makePendingPlatformCookie, readPending } from "@/lib/platform/identity";
import { verifyQstashSignature } from "@/lib/notifications/qstash";
describe("platform linking security",()=>{it("round trips a signed pending identity",()=>{const raw=makePendingPlatformCookie({id:"123",username:"player"},"TELEGRAM");expect(readPending(raw)?.user.id).toBe("123");expect(readPending(`${raw}x`)).toBeNull()});it("rejects an invalid QStash signature",async()=>{expect(await verifyQstashSignature('{"matchId":"m"}',"not-a-jwt")).toBe(false)})});
