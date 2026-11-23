import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\r\n]+)$/i;
const PUBLIC_CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  if (!ObjectId.isValid(userId))
    return new Response(null, { status: 404 });
  const db = await getDb();
  const user = await db.collection<any>("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { avatarUrl: 1 } },
  );
  const avatar = user?.avatarUrl;
  if (typeof avatar !== "string")
    return new Response(null, { status: 404 });
  const match = DATA_IMAGE.exec(avatar);
  if (!match || match[2].length > 1_400_000)
    return new Response(null, { status: 404 });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_000_000 || bytes.length === 0)
    return new Response(null, { status: 404 });
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1].toLowerCase(),
      "Cache-Control": PUBLIC_CACHE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
