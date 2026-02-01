import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      {message}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        <div className="h-12 w-12 mx-auto mb-3 opacity-50 flex items-center justify-center">
          {icon}
        </div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm mt-1">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  icon: ReactNode;
  message?: string;
}

export function ErrorState({ icon, message = "An error occurred" }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-destructive">
      <div className="h-8 w-8 mb-2 flex items-center justify-center">
        {icon}
      </div>
      <p>{message}</p>
    </div>
  );
}
