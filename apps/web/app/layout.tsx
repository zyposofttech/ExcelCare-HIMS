import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";

// ChatGPT-like typography: Inter shipped via Next, with a CSS variable used by Tailwind.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = { title: "ExcelCare HIMS" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-xc-bg text-xc-text`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
