import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRefundOwnership, normalizeEmail } from "@/lib/refunds/ownership";

// GET /api/refunds/RR-5029/check
// Server-side ownership check for one refund request. The signed-in guest must
// be the requester, and the requester must be the booking's guest.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ allowed: false, reason: "not_signed_in" }, { status: 401 });
  }

  // Row Level Security only returns rows that belong to the signed-in guest.
  const { data: refund } = await supabase
    .from("refund_requests")
    .select("request_id, booking_id, requester_email")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!refund || normalizeEmail(refund.requester_email) !== normalizeEmail(user.email)) {
    return NextResponse.json({ allowed: false, reason: "request_not_found" }, { status: 404 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_id, guest_user_email")
    .eq("booking_id", refund.booking_id)
    .maybeSingle();

  const result = checkRefundOwnership(refund, booking);
  return NextResponse.json(result, { status: result.allowed ? 200 : 403 });
}
