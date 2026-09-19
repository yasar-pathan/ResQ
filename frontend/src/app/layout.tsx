import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RescueGrid",
  description: "Emergency response coordination platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
