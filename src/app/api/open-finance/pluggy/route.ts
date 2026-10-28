import { NextResponse } from "next/server";
import { validPluggyWebhook } from "@/lib/open-finance/widget";
import { pluggyWebhookSchema, OpenFinanceError } from "@/lib/open-finance/schema";
import { registerPluggyWidgetItem } from "@/lib/open-finance/register-widget-item";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!validPluggyWebhook(request)) return new NextResponse(null, { status: 401 });
  try {
    const event = pluggyWebhookSchema.safeParse(await request.json());
    if (!event.success) return new NextResponse(null, { status: 400 });
    if (!["item/created", "item/updated"].includes(event.data.event)) return new NextResponse(null, { status: 204 });
    if (!event.data.itemId) return new NextResponse(null, { status: 400 });
    const userId = process.env.OPEN_FINANCE_USER_ID?.trim();
    if (!userId) return new NextResponse(null, { status: 401 });
    await registerPluggyWidgetItem(userId, event.data.itemId, false);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SyntaxError) return new NextResponse(null, { status: 400 });
    // Unrelated items from the same application are deliberately ignored.
    // Transient provider/database failures are retried by Pluggy.
    return new NextResponse(null, { status: error instanceof OpenFinanceError && error.code === "access" ? 204 : 503 });
  }
}
