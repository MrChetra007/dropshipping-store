import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CJ Dropshipping Store",
  description: "Storefront powered by CJ Dropshipping.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              CJ Store
            </Link>
            <div className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/products" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Products
              </Link>
              <Link href="/account" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Account
              </Link>
              <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Log in
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
