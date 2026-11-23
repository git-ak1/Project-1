-- Export used by scripts/refund-decisions.mts (run with the service role / SQL editor).
select json_agg(x order by x.request_id) as rows from (
  select r.request_id,
         to_char(r.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as submitted_at,
         r.requester_email, r.booking_id, r.request_reason, r.requested_amount::text as requested_amount,
         b.guest_user_email, b.check_in::text as check_in, b.cancellation_policy,
         b.total_paid::text as total_paid, b.amount_already_refunded::text as amount_already_refunded
  from public.refund_requests r
  left join public.bookings b on b.booking_id = r.booking_id
) x;
