-- Table privileges for the refund tables.
--
-- anon (publishable key, not signed in): no access at all.
-- authenticated (signed-in guest): read only; Row Level Security then limits
-- each guest to rows whose email matches their login email.
-- Writes stay server-side only (service role / SQL), never from the browser.

revoke all on public.bookings, public.refund_requests, public.refund_request_checks
  from anon, authenticated;

grant select on public.bookings, public.refund_requests, public.refund_request_checks
  to authenticated;
