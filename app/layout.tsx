import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guest Sign In",
  description: "Sign in to guest support",
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
