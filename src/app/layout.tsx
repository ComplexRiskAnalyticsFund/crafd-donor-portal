import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// https://fonts.google.com/specimen/Roboto
// 100 (Thin), 300 (Light), 400 (Regular), 500 (Medium), 700 (Bold), 800 (ExtraBold), 900 (Black)
const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "800", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRAF'd Transparency Portal",
  description:
    "The CRAF’d Transparency Portal provides key information about CRAF’d, including how it is governed, financed and implemented.",
  openGraph: {
    title: "CRAF'd Transparency Portal",
    description:
      "The CRAF’d Transparency Portal provides key information about CRAF’d, including how it is governed, financed and implemented.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcb000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.className} antialiased`}>
      <body suppressHydrationWarning>
        {children}
        <GoogleAnalytics gaId="G-XYZ" />
      </body>
    </html>
  );
}
