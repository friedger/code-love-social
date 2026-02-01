import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, LogOut, User as UserIcon, Loader2, Zap } from "lucide-react";
import type { UnifiedUser } from "@/hooks/useAuth";

interface AuthButtonProps {
  user: UnifiedUser | null;
  isLoading: boolean;
  hasNostrExtension: boolean;
  onLoginAtproto: (handle: string) => Promise<void>;
  onLoginNostr: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function AuthButton({
  user,
  isLoading,
  hasNostrExtension,
  onLoginAtproto,
  onLoginNostr,
  onLogout,
}: AuthButtonProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [handle, setHandle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("bluesky");

  const handleAtprotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    setIsSubmitting(true);
    try {
      await onLoginAtproto(handle.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNostrLogin = async () => {
    setIsSubmitting(true);
    try {
      await onLoginNostr();
      setShowLoginDialog(false);
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
    const profilePath =
      user.authType === "atproto"
        ? `/profile/${user.handle}`
        : `/profile/${user.id}`;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.displayName}</span>
            {user.authType === "nostr" && (
              <Zap className="h-3 w-3 text-amber-500" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {user.authType === "atproto" ? `@${user.handle}` : user.id.slice(0, 16) + "..."}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.authType === "atproto" ? "Bluesky" : "Nostr"}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to={profilePath}>
              <UserIcon className="h-4 w-4 mr-2" /> Profile
            </Link>
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
        <LogIn className="h-4 w-4 mr-2" /> Sign in
      </Button>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>
              Choose your preferred authentication method.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bluesky">Bluesky</TabsTrigger>
              <TabsTrigger value="nostr" className="gap-1">
                <Zap className="h-3 w-3" />
                Nostr
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bluesky" className="space-y-4 mt-4">
              <form onSubmit={handleAtprotoSubmit} className="space-y-4">
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
            </TabsContent>

            <TabsContent value="nostr" className="space-y-4 mt-4">
              <div className="space-y-4">
                {hasNostrExtension ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Sign in using your Nostr browser extension (NIP-07).
                    </p>
                    <Button
                      className="w-full"
                      onClick={handleNostrLogin}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Sign in with Extension
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-3 py-4">
                    <Zap className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No Nostr extension detected.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Install a NIP-07 compatible extension like{" "}
                      <a
                        href="https://getalby.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Alby
                      </a>{" "}
                      or{" "}
                      <a
                        href="https://github.com/nicehash/NiceWallet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        nos2x
                      </a>{" "}
                      to sign in with Nostr.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
