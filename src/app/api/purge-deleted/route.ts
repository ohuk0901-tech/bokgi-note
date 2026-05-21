import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const expectedSecret = process.env.ADMIN_JOB_SECRET;
  const headerSecret = request.headers.get("x-admin-job-secret");

  if (!expectedSecret || headerSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("purge_deleted_items");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
