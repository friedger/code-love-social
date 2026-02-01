import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BlueskyLoginFormProps {
  onSubmit: (handle: string) => Promise<void>;
  isSubmitting: boolean;
}

export function BlueskyLoginForm({ onSubmit, isSubmitting }: BlueskyLoginFormProps) {
  const [handle, setHandle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    await onSubmit(handle.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="handle">Handle</Label>
        <Input
          id="handle"
          placeholder="yourname.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Enter your full handle (e.g., alice.bsky.social)
        </p>
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || !handle.trim()}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          "Continue with Bluesky"
        )}
      </Button>
    </form>
  );
}
