import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chemcider Labs | Chemistry Intelligence Platform",
  description:
    "A trusted digital workspace for chemical research, scientific data, virtual experiments, and reproducible laboratory records.",
};

const themeScript = `
  try {
    const saved = localStorage.getItem("chemcider-theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = saved || (systemDark ? "dark" : "light");
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
