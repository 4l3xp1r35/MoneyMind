import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { fetchBybit } from "@/lib/platforms/bybit";
import { fetchMexc } from "@/lib/platforms/mexc";
import { fetchTrading212 } from "@/lib/platforms/trading212";
import type { PlatformResult } from "@/lib/platforms/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platforms = await prisma.platform.findMany({
    where: { userId: session.user.id, isEnabled: true },
  });

  const results: PlatformResult[] = await Promise.all(
    platforms.map(async (p): Promise<PlatformResult> => {
      const base: PlatformResult = {
        platformId: p.id,
        label: p.label,
        name: p.name,
        success: false,
        holdings: [],
        totalValueUsd: 0,
        fetchedAt: new Date().toISOString(),
      };

      try {
        const key = decrypt(p.apiKey);
        const secret = p.apiSecret ? decrypt(p.apiSecret) : "";

        let holdings = base.holdings;

        if (p.name === "bybit") {
          holdings = await fetchBybit(key, secret);
        } else if (p.name === "mexc") {
          holdings = await fetchMexc(key, secret);
        } else if (p.name === "trading212") {
          const extra = p.extra as Record<string, string> | null;
          holdings = await fetchTrading212(key, extra?.mode === "demo" ? "demo" : "live");
        } else {
          return { ...base, error: "Platform not yet supported" };
        }

        const totalValueUsd = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
        return { ...base, success: true, holdings, totalValueUsd };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { ...base, error: msg };
      }
    })
  );

  const totalValueUsd = results.reduce((s, r) => s + r.totalValueUsd, 0);

  // Allocation by platform type
  const allocation = results
    .filter((r) => r.success && r.totalValueUsd > 0)
    .map((r) => ({
      label: r.label,
      name: r.name,
      value: r.totalValueUsd,
      percentage: totalValueUsd > 0 ? (r.totalValueUsd / totalValueUsd) * 100 : 0,
    }));

  return NextResponse.json({ platforms: results, totalValueUsd, allocation });
}
