import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { GlobalLoader } from "@/components/global-loading/GlobalLoader";
import { GlobalNavWatcher } from "@/components/global-loading/GlobalNavWatcher";
import { NavigationLoader } from "@/components/NavigationLoader";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ZypoCare One",
  description: "ZypoCare One - AI Powered Hospital Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-zc-bg text-zc-text`}>
        <ThemeProvider>
          <GlobalNavWatcher />
          {children}
          <GlobalLoader />
          <Toaster />
        </ThemeProvider>

        <Toaster />
      </body>
    </html>
  );
}