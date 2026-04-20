import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_KEY ?? "",
  );
}

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id") ?? "demo_dreamer";

  try {
    const { data, error } = await getSupabase()
      .from("user_dreams")
      .select("id, user_id, raw_text, recorded_at, emotion_tags, symbol_tags, character_tags, interaction_type, lucidity_score, vividness_score, hvdc_codes")
      .eq("user_id", user_id)
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ dreams: [], error: error.message });
    }

    return NextResponse.json({ dreams: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ dreams: [], error: e?.message });
  }
}
