import { NextRequest, NextResponse } from "next/server";
import { getServerSettings, updateServerSettings } from "@/services/serverStore";
import { updateSettingsSchema } from "@/lib/validations/schemas";

export async function GET() {
  const settings = await getServerSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || "Invalid settings configuration",
        },
        { status: 400 }
      );
    }

    const updated = await updateServerSettings(parsed.data);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
