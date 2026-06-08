import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MoneyMind",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  // Standalone full-screen layout — no sidebar, no desktop nav
  return <>{children}</>;
}
