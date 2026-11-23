// Batch replay of the refund policy over Sep-Nov 2026 requests.
//
// Usage:
//   node scripts/refund-decisions.mts <supabase-export.json> <out-dir>
//
// <supabase-export.json> is the result of supabase/queries/refund_replay_export.sql:
// one object per refund request joined to its booking. It is not committed
// (it contains guest emails).
//
// Replay session: these requests happened before any Supabase session was
// stored (auth.sessions is empty), so each request is replayed as if sent
// from a session signed in as its requester_email. In the live app the
// session email comes from supabase.auth.getUser() instead
// (app/api/refunds/[requestId]/check/route.ts).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { decideRefund, AUTO_REFUND_CAP_CENTS, formatUsd } from "../lib/refunds/policy.ts";

type ExportRow = {
  request_id: string;
  submitted_at: string;
  requester_email: string;
  booking_id: string;
  request_reason: string;
  requested_amount: string;
  guest_user_email: string | null;
  check_in: string | null;
  cancellation_policy: string | null;
  total_paid: string | null;
  amount_already_refunded: string | null;
};

const [, , inputPath, outDir] = process.argv;
if (!inputPath || !outDir) {
  console.error("Usage: node scripts/refund-decisions.mts <export.json> <out-dir>");
  process.exit(1);
}

const rows: ExportRow[] = JSON.parse(readFileSync(inputPath, "utf8"));

const details = rows
  .sort((a, b) => a.request_id.localeCompare(b.request_id))
  .map((r) => {
    const booking =
      r.guest_user_email === null
        ? null
        : {
            booking_id: r.booking_id,
            guest_user_email: r.guest_user_email,
            check_in: r.check_in!,
            cancellation_policy: r.cancellation_policy!,
            total_paid: r.total_paid!,
            amount_already_refunded: r.amount_already_refunded!,
          };
    const replaySessionEmail = r.requester_email;
    return decideRefund(r, booking, replaySessionEmail);
  });

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

mkdirSync(outDir, { recursive: true });
const header = "request_id,booking_id,request_reason,refund_decision,amount_usd";
writeFileSync(
  `${outDir}/refund_decisions.csv`,
  [header, ...details.map((d) =>
    [d.request_id, d.booking_id, d.request_reason, d.refund_decision, d.amount_usd].map(csvCell).join(","),
  )].join("\n") + "\n",
);
writeFileSync(
  `${outDir}/refund_decisions_detail.csv`,
  [header + ",why,notice_hours,payable_usd", ...details.map((d) =>
    [d.request_id, d.booking_id, d.request_reason, d.refund_decision, d.amount_usd, d.why,
     d.notice_hours === null ? "" : d.notice_hours.toFixed(2), d.payable_usd ?? ""].map(csvCell).join(","),
  )].join("\n") + "\n",
);

const counts: Record<string, number> = {};
let paidCents = 0;
for (const d of details) {
  counts[d.refund_decision] = (counts[d.refund_decision] ?? 0) + 1;
  if (d.refund_decision === "approved") paidCents += Math.round(Number(d.amount_usd) * 100);
}
console.log(`requests: ${details.length}, cap: ${formatUsd(AUTO_REFUND_CAP_CENTS)}`);
console.log("decisions:", counts);
console.log(`total auto-paid: ${formatUsd(paidCents)}`);
