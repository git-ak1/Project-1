// Edge-case tests for lib/refunds/policy.ts. Run: node --test scripts/refund-policy.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideRefund, AUTO_REFUND_CAP_CENTS } from "../lib/refunds/policy.ts";

const booking = (over: Partial<Parameters<typeof decideRefund>[1] & object> = {}) => ({
  booking_id: "B1",
  guest_user_email: "guest@example.com",
  check_in: "2026-12-20",
  cancellation_policy: "Flexible",
  total_paid: "300.00",
  amount_already_refunded: "0.00",
  ...over,
});
const request = (over: Partial<Parameters<typeof decideRefund>[0]> = {}) => ({
  request_id: "RR-1",
  booking_id: "B1",
  request_reason: "cancelled_before_check_in",
  submitted_at: "2026-12-01T00:00:00Z",
  requested_amount: "300.00",
  ...over,
});

test("cap is US$500.00", () => assert.equal(AUTO_REFUND_CAP_CENTS, 50000));

test("policy worked example: Strict 1200, 9 days, payable 600 -> above cap, escalated", () => {
  const d = decideRefund(
    request({ submitted_at: "2026-12-11T00:00:00Z", requested_amount: "1200.00" }),
    booking({ cancellation_policy: "Strict", total_paid: "1200.00" }),
    "guest@example.com",
  );
  assert.equal(d.refund_decision, "escalated_human_approval");
  assert.equal(d.amount_usd, "600.00");
});

test("unknown booking -> blocked_not_owner", () => {
  assert.equal(decideRefund(request(), null, "guest@example.com").refund_decision, "blocked_not_owner");
});

test("different session email -> blocked_not_owner, $0", () => {
  const d = decideRefund(request(), booking(), "someone.else@example.com");
  assert.equal(d.refund_decision, "blocked_not_owner");
  assert.equal(d.amount_usd, "0.00");
});

test("no session -> blocked_not_owner", () => {
  assert.equal(decideRefund(request(), booking(), null).refund_decision, "blocked_not_owner");
});

test("email match ignores case and spaces", () => {
  assert.equal(decideRefund(request(), booking(), "  GUEST@example.com ").refund_decision, "approved");
});

test("notice exactly at the window is enough; one second short is not", () => {
  const b = booking({ cancellation_policy: "Moderate", check_in: "2026-12-20" });
  assert.equal(decideRefund(request({ submitted_at: "2026-12-15T00:00:00Z" }), b, "guest@example.com").refund_decision, "approved");
  assert.equal(decideRefund(request({ submitted_at: "2026-12-15T00:00:01Z" }), b, "guest@example.com").refund_decision, "blocked_ineligible");
});

test("payable = total x % - already refunded, capped at requested", () => {
  const d = decideRefund(
    request({ requested_amount: "100.00" }),
    booking({ total_paid: "300.00", amount_already_refunded: "50.00" }),
    "guest@example.com",
  );
  assert.equal(d.amount_usd, "100.00");
  const d2 = decideRefund(request({ requested_amount: "999.00" }), booking({ amount_already_refunded: "50.00" }), "guest@example.com");
  assert.equal(d2.amount_usd, "250.00");
});

test("already fully refunded -> blocked_ineligible", () => {
  const d = decideRefund(request(), booking({ amount_already_refunded: "300.00" }), "guest@example.com");
  assert.equal(d.refund_decision, "blocked_ineligible");
});

test("exactly the cap is approved; one cent more is escalated", () => {
  const at = decideRefund(request({ requested_amount: "500.00" }), booking({ total_paid: "800.00" }), "guest@example.com");
  assert.equal(at.refund_decision, "approved");
  assert.equal(at.amount_usd, "500.00");
  const over = decideRefund(request({ requested_amount: "500.01" }), booking({ total_paid: "800.00" }), "guest@example.com");
  assert.equal(over.refund_decision, "escalated_human_approval");
});

test("Strict 50% of an odd-cent total rounds to cents", () => {
  const d = decideRefund(
    request({ submitted_at: "2026-12-01T00:00:00Z", requested_amount: "999.00" }),
    booking({ cancellation_policy: "Strict", total_paid: "389.99" }),
    "guest@example.com",
  );
  assert.equal(d.amount_usd, "195.00");
});
