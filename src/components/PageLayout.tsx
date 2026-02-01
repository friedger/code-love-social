import { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: "default" | "narrow" | "wide";
}

const maxWidthClasses = {
  default: "",
  narrow: "max-w-3xl",
  wide: "max-w-6xl",
};

export function PageLayout({ children, maxWidth = "default" }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader />
      <main className={`container mx-auto px-3 sm:px-4 py-4 sm:py-6 ${maxWidthClasses[maxWidth]}`}>
        {children}
      </main>
    </div>
  );
}
