import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MatrixLoginFormProps {
  onSubmit: (userId: string, password: string) => Promise<void>;
  isSubmitting: boolean;
}

export function MatrixLoginForm({ onSubmit, isSubmitting }: MatrixLoginFormProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password) return;
    await onSubmit(userId.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="matrix-user">User ID</Label>
        <Input
          id="matrix-user"
          placeholder="@username:matrix.org"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Enter your full Matrix user ID (e.g., @alice:matrix.org)
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="matrix-password">Password</Label>
        <Input
          id="matrix-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || !userId.trim() || !password}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in with Matrix"
        )}
      </Button>
    </form>
  );
}
