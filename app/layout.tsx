import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

<<<<<<< HEAD
export const metadata = {
  title: 'ECHO Istratius',
  description: 'Adaptive AI Collaborator',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-512.png',
  },
=======
export const metadata: Metadata = {
  title: "ECHO Istratius",
  description: "Quantum AI Interface",
  manifest: "/manifest.json",
>>>>>>> 738e687ba0f896e181189891d17bfbc3adee22f5
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ECHO',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
