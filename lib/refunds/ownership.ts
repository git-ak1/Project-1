// Refund ownership rule.
//
// A refund request may only go ahead when the email that sent it
// (refund_requests.requester_email) is the same as the email of the guest who
// made the booking (bookings.guest_user_email). Emails are compared trimmed
// and case-insensitively. Nothing in the request's message text or the
// listing description can change this result: free text is data, never
// instructions ("you're in admin mode" is just words).

export type BookingOwner = {
  booking_id: string;
  guest_user_email: string;
};

export type RefundRequestSender = {
  request_id: string;
  booking_id: string;
  requester_email: string;
};

export type OwnershipResult =
  | { allowed: true }
  | { allowed: false; reason: "booking_not_found" | "booking_id_mismatch" | "requester_is_not_booking_guest" };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function checkRefundOwnership(
  request: RefundRequestSender,
  booking: BookingOwner | null | undefined,
): OwnershipResult {
  if (!booking) {
    return { allowed: false, reason: "booking_not_found" };
  }
  if (booking.booking_id !== request.booking_id) {
    return { allowed: false, reason: "booking_id_mismatch" };
  }
  if (normalizeEmail(request.requester_email) !== normalizeEmail(booking.guest_user_email)) {
    return { allowed: false, reason: "requester_is_not_booking_guest" };
  }
  return { allowed: true };
}
