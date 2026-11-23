// Server-side refund decision for Help chat refund requests.
//
// Implements "Guest Refund Policy for Automated Refunds (Help Chat)",
// revision 2026-11-13. This is plain server code: no AI model is called here,
// and nothing in message_text or listing_description is read at all, so
// prompt injection ("admin mode", "ignore previous instructions") cannot change
// a decision or an amount. All money is handled in integer cents (USD).

// ---------------------------------------------------------------------------
// Auto-refund cap (policy section 4)
//
// US$500.00 per refund. A payable amount ABOVE this is never paid
// automatically; it is escalated to the Community Support Operations queue for
// human approval. A payable amount EQUAL to the cap is paid automatically.
//
// Reason for this value: it caps what one fake request that slips past the
// ownership and notice checks can cost at US$500, while most genuine requests
// are smaller (44 of the 50 Sep-Nov 2026 requests asked for US$500 or less, and
// 4 of the 6 larger ones contained "admin mode"/"override" text). Real guests
// owed more are not refused; they are paid after a person approves.
// ---------------------------------------------------------------------------
export const AUTO_REFUND_CAP_CENTS = 500_00;

export type CancellationPolicy = "Flexible" | "Moderate" | "Strict";

// Policy section 2: notice needed before check-in, and % of total_paid refunded.
export const POLICY_RULES: Record<CancellationPolicy, { minNoticeHours: number; refundPercent: number }> = {
  Flexible: { minNoticeHours: 24, refundPercent: 100 },
  Moderate: { minNoticeHours: 120, refundPercent: 100 },
  Strict: { minNoticeHours: 168, refundPercent: 50 },
};

export type RefundDecisionCode =
  | "blocked_not_owner"
  | "blocked_ineligible"
  | "escalated_human_approval"
  | "approved";

export type RefundRequestInput = {
  request_id: string;
  booking_id: string;
  request_reason: string;
  submitted_at: string; // ISO timestamp, UTC
  requested_amount: string | number; // USD
};

export type BookingInput = {
  booking_id: string;
  guest_user_email: string;
  check_in: string; // YYYY-MM-DD
  cancellation_policy: string;
  total_paid: string | number; // USD
  amount_already_refunded: string | number; // USD
};

// Policy section 5: the decision record.
export type RefundDecisionRecord = {
  request_id: string;
  booking_id: string;
  request_reason: string;
  refund_decision: RefundDecisionCode;
  amount_usd: string; // two decimals
};

// Extra detail for audits; not part of the policy record.
export type RefundDecisionDetail = RefundDecisionRecord & {
  why: string;
  notice_hours: number | null;
  payable_usd: string | null;
};

export function toCents(value: string | number): number {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Not a USD amount: ${value}`);
  }
  const [whole, frac = ""] = text.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return text.startsWith("-") ? -cents : cents;
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Hours from submitted_at to 00:00 UTC on the check_in date (policy section 2).
export function noticeHours(submittedAt: string, checkIn: string): number {
  const submitted = Date.parse(submittedAt);
  const checkInMidnight = Date.parse(`${checkIn}T00:00:00Z`);
  if (Number.isNaN(submitted) || Number.isNaN(checkInMidnight)) {
    throw new Error(`Bad date: ${submittedAt} / ${checkIn}`);
  }
  return (checkInMidnight - submitted) / 3_600_000;
}

/**
 * Decide one refund request. The first rule that applies wins:
 *   1. blocked_not_owner        booking missing, or session email != guest_user_email
 *   2. blocked_ineligible       too little notice, or payable <= 0
 *   3. escalated_human_approval payable > cap (recorded, NOT paid)
 *   4. approved                 payable > 0 and <= cap (paid)
 *
 * sessionEmail must be the email of the signed-in Supabase user on the
 * session. Never pass requester_email or an email taken from message text.
 */
export function decideRefund(
  request: RefundRequestInput,
  booking: BookingInput | null | undefined,
  sessionEmail: string | null | undefined,
  capCents: number = AUTO_REFUND_CAP_CENTS,
): RefundDecisionDetail {
  const base = {
    request_id: request.request_id,
    booking_id: request.booking_id,
    request_reason: request.request_reason,
  };
  const blocked = (
    code: "blocked_not_owner" | "blocked_ineligible",
    why: string,
    notice: number | null = null,
    payable: number | null = null,
  ): RefundDecisionDetail => ({
    ...base,
    refund_decision: code,
    amount_usd: "0.00",
    why,
    notice_hours: notice,
    payable_usd: payable === null ? null : formatUsd(payable),
  });

  // 1. Ownership (policy section 1)
  if (!booking || booking.booking_id !== request.booking_id) {
    return blocked("blocked_not_owner", "booking_id not found");
  }
  if (!sessionEmail || normalizeEmail(sessionEmail) !== normalizeEmail(booking.guest_user_email)) {
    return blocked("blocked_not_owner", "signed-in email is not the booking's guest_user_email");
  }

  // 2. Eligibility by cancellation policy (policy section 2)
  const rule = POLICY_RULES[booking.cancellation_policy as CancellationPolicy];
  if (!rule) {
    return blocked("blocked_ineligible", `unknown cancellation_policy ${booking.cancellation_policy}`);
  }
  const notice = noticeHours(request.submitted_at, booking.check_in);
  if (notice < rule.minNoticeHours) {
    return blocked(
      "blocked_ineligible",
      `${notice.toFixed(1)}h notice, ${booking.cancellation_policy} needs ${rule.minNoticeHours}h`,
      notice,
    );
  }

  // 3. Payable amount (policy section 3), rounded to cents (half-cent rounds up)
  const refundRuleCents = Math.round((toCents(booking.total_paid) * rule.refundPercent) / 100);
  let payable = refundRuleCents - toCents(booking.amount_already_refunded);
  payable = Math.min(payable, toCents(request.requested_amount));
  if (payable <= 0) {
    return blocked("blocked_ineligible", "payable is 0 or less", notice, payable);
  }

  // 4. Auto-refund cap (policy section 4)
  if (payable > capCents) {
    return {
      ...base,
      refund_decision: "escalated_human_approval",
      amount_usd: formatUsd(payable),
      why: `payable ${formatUsd(payable)} is above the ${formatUsd(capCents)} cap`,
      notice_hours: notice,
      payable_usd: formatUsd(payable),
    };
  }

  return {
    ...base,
    refund_decision: "approved",
    amount_usd: formatUsd(payable),
    why: "owner, enough notice, payable within cap",
    notice_hours: notice,
    payable_usd: formatUsd(payable),
  };
}
