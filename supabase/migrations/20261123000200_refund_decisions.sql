-- Refund decisions per "Guest Refund Policy for Automated Refunds (Help Chat)" (rev. 2026-11-13).
--
-- Ownership is the signed-in Supabase session email vs bookings.guest_user_email.
-- The old view compared requester_email instead, which the policy says never
-- establishes ownership, so it is removed.

drop view if exists public.refund_request_checks;

create table if not exists public.refund_decisions (
  request_id      text primary key references public.refund_requests (request_id),
  booking_id      text not null,
  request_reason  text not null,
  refund_decision text not null check (refund_decision in
                    ('blocked_not_owner', 'blocked_ineligible', 'escalated_human_approval', 'approved')),
  amount_usd      numeric(10, 2) not null check (amount_usd >= 0),
  decided_at      timestamptz not null default now(),
  policy_revision text not null default '2026-11-13',
  cap_usd         numeric(10, 2) not null default 500.00,
  check (refund_decision in ('approved', 'escalated_human_approval') or amount_usd = 0)
);

alter table public.refund_decisions enable row level security;

-- Written only by the server (service role / SQL). No browser access.
revoke all on public.refund_decisions from anon, authenticated;
