import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface WarningBannerProps {
  children: ReactNode;
}

export function WarningBanner({ children }: WarningBannerProps) {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
      <div className="container mx-auto flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{children}</span>
      </div>
    </div>
  );
}
