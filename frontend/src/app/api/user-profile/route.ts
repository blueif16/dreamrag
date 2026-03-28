import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_KEY ?? "",
);

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id") ?? "default";

  try {
    // Fetch all dreams for this user (raw_text + tags + metadata)
    const { data: dreams, error } = await supabase
      .from("user_dreams")
      .select("id, recorded_at, emotion_tags, symbol_tags, lucidity_score")
      .eq("user_id", user_id)
      .order("recorded_at", { ascending: false })
      .limit(200);

    if (error || !dreams) throw error ?? new Error("no data");

    // ── Emotion distribution ────────────────────────────────────────────────
    const emotionCounts: Record<string, number> = {};
    let totalTagged = 0;
    for (const d of dreams) {
      if (d.emotion_tags?.length) {
        totalTagged++;
        for (const tag of d.emotion_tags) {
          emotionCounts[tag] = (emotionCounts[tag] ?? 0) + 1;
        }
      }
    }
    const emotion_distribution = totalTagged > 0
      ? Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, count]) => ({ label, pct: Math.round((count / totalTagged) * 100) }))
      : [];

    // ── Symbol recurrence ───────────────────────────────────────────────────
    const symbolCounts: Record<string, { count: number; dates: string[] }> = {};
    for (const d of dreams) {
      if (d.symbol_tags?.length) {
        for (const sym of d.symbol_tags) {
          if (!symbolCounts[sym]) symbolCounts[sym] = { count: 0, dates: [] };
          symbolCounts[sym].count++;
          symbolCounts[sym].dates.push(d.recorded_at);
        }
      }
    }
    const recurrence = Object.entries(symbolCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([symbol, { count, dates }]) => ({
        label: symbol,
        value: `${((count / Math.max(dreams.length, 1)) * 100).toFixed(1)}%`,
        note: `Appears in ${count} of ${dreams.length} dreams`,
      }));

    // ── Streak ──────────────────────────────────────────────────────────────
    const now = new Date();
    const last7: boolean[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return dreams.some((dr) => dr.recorded_at?.slice(0, 10) === key);
    });
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (last7[i]) streak++;
      else break;
    }

    // ── Lucidity avg ────────────────────────────────────────────────────────
    const lucid = dreams.filter((d) => d.lucidity_score != null);
    const lucidity_avg = lucid.length
      ? lucid.reduce((s, d) => s + d.lucidity_score, 0) / lucid.length
      : null;

    return NextResponse.json({
      user_id,
      total_dreams: dreams.length,
      emotion_distribution,
      recurrence,
      streak,
      last7,
      lucidity_avg,
    });
  } catch (e: any) {
    // Return empty profile — widgets show "no data yet" state
    return NextResponse.json({
      user_id,
      total_dreams: 0,
      emotion_distribution: [],
      recurrence: [],
      streak: 0,
      last7: [false, false, false, false, false, false, false],
      lucidity_avg: null,
      error: e?.message,
    });
  }
}
