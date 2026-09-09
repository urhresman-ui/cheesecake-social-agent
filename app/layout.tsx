import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Us & Cheesecake | Social priprava",
  description:
    "Interna priprava Instagram objav in storyjev za Us & Cheesecake.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
