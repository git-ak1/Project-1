import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decideRefund } from "@/lib/refunds/policy";

// GET /api/refunds/RR-5029/check
//
// Server-side refund decision for one request, per the Help chat refund
// policy. Ownership uses ONLY the signed-in Supabase session email
// (supabase.auth.getUser), never requester_email or anything in message_text.
// This route only decides; it does not pay.
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
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  // RLS: a guest can only read requests whose requester_email is their login email.
  const { data: refund } = await supabase
    .from("refund_requests")
    .select("request_id, booking_id, request_reason, submitted_at, requested_amount")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!refund) {
    return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  }

  // RLS: a guest can only read bookings whose guest_user_email is their login
  // email, so another guest's booking comes back as null -> blocked_not_owner.
  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_id, guest_user_email, check_in, cancellation_policy, total_paid, amount_already_refunded")
    .eq("booking_id", refund.booking_id)
    .maybeSingle();

  const decision = decideRefund(
    { ...refund, requested_amount: String(refund.requested_amount) },
    booking
      ? {
          ...booking,
          total_paid: String(booking.total_paid),
          amount_already_refunded: String(booking.amount_already_refunded),
        }
      : null,
    user.email,
  );

  const { request_id, booking_id, request_reason, refund_decision, amount_usd } = decision;
  return NextResponse.json({ request_id, booking_id, request_reason, refund_decision, amount_usd });
}
