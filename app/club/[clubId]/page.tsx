import { redirect } from "next/navigation";
export default async function ClubRoot({ params }: { params: Promise<{ clubId: string }> }) { const { clubId } = await params; redirect(`/club/${clubId}/match-centre`); }
