import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, LogOut, User as UserIcon, Loader2 } from "lucide-react";
import type { AtprotoUser } from "@/hooks/useAtprotoAuth";

interface AuthButtonProps {
  user: AtprotoUser | null;
  isLoading: boolean;
  onLogin: (handle: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function AuthButton({ user, isLoading, onLogin, onLogout }: AuthButtonProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [handle, setHandle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onLogin(handle.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">@{user.handle}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserIcon className="h-4 w-4 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button onClick={() => setShowLoginDialog(true)}>
        <LogIn className="h-4 w-4 mr-2" /> Sign in with Bluesky
      </Button>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in with AT Protocol</DialogTitle>
            <DialogDescription>
              Enter your Bluesky handle to sign in. You'll be redirected to authorize this app.
            </DialogDescription>
          </DialogHeader>
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
                Enter your full handle (e.g., alice.bsky.social or your custom domain)
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !handle.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
