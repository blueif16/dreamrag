import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_KEY ?? "",
  );
}

const EMPTY_PROFILE = {
  emotion_distribution: [],
  recurrence: [],
  current_streak: 0,
  last7: [false, false, false, false, false, false, false],
  heatmap_data: [],
  heatmap_month: "",
  total_dreams: 0,
};

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id") ?? "demo_dreamer";

  try {
    const { data, error } = await getSupabase()
      .from("user_profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ user_id, ...EMPTY_PROFILE });
    }

    return NextResponse.json({
      user_id: data.user_id,
      emotion_distribution: data.emotion_distribution ?? [],
      recurrence: data.recurrence ?? [],
      current_streak: data.current_streak ?? 0,
      last7: data.last7 ?? EMPTY_PROFILE.last7,
      heatmap_month: data.heatmap_month ?? "",
      heatmap_data: data.heatmap_data ?? [],
      total_dreams: data.total_dreams ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ user_id, ...EMPTY_PROFILE, error: e?.message });
  }
}
