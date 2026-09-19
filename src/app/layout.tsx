import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EVOLVE — an evolutionary ecosystem",
  description: "You don't create life. You create the conditions for it.",
};

export const viewport: Viewport = {
  themeColor: "#070a06",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pressStart.variable} ${vt323.variable} h-full`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
