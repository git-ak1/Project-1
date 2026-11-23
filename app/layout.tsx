import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airbnb Help Chat Refund Safety",
  description:
    "Guarded guest support chat with Supabase sign-in, server-side refund checks and prompt injection screening",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
