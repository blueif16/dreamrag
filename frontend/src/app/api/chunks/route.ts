import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_KEY ?? "",
  );
}

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);

  if (ids.length === 0) {
    return NextResponse.json({ chunks: [] });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("id, content, metadata, namespace, created_at")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chunks: data ?? [] });
}
