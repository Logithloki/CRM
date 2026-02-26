import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "CRM Dashboard",
    description: "Modern CRM application for lead management and collaboration",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen">{children}</body>
        </html>
    );
}
