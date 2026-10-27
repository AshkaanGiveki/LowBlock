import { GET as getLocalTeamLogo } from "@/app/api/team-logo/[teamId]/route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  return getLocalTeamLogo(request, { params });
}
