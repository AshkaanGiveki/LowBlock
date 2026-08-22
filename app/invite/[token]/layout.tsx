import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const db = await getDb();
  const invite = await db.collection<any>("clubInvitations").findOne({ tokenHash: hash(token), kind: "CLUB_LINK", status: "ACTIVE" }, { projection: { clubId: 1 } });
  const club = invite ? await db.collection<any>("clubs").findOne({ _id: ObjectId.isValid(String(invite.clubId)) ? new ObjectId(String(invite.clubId)) : invite.clubId }, { projection: { name: 1, imageUrl: 1 } }) : null;
  const name = club?.name ?? "LowBlock Club";
  const title = `Join ${name} on LowBlock`;
  const description = `You are invited to join ${name} and compete together on LowBlock.`;
  const image = club?.imageUrl && /^(https?:\/\/|\/)/i.test(club.imageUrl) ? club.imageUrl : "/lowblock.png";
  return { title, description, openGraph: { type: "website", title, description, siteName: "LowBlock", images: [{ url: image, width: 1200, height: 630, alt: `${name} on LowBlock` }] }, twitter: { card: "summary_large_image", title, description, images: [image] }, robots: { index: false, follow: false } };
}

export default function InviteLayout({ children }: { children: React.ReactNode }) { return children; }
