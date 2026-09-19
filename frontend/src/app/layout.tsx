import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RescueGrid",
  description: "Emergency response coordination — report incidents and request SOS help",
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
