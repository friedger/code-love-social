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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, LogOut, User as UserIcon, Loader2, Zap, Grid3X3 } from "lucide-react";
import { BlueskyLoginForm, NostrLoginForm, MatrixLoginForm } from "@/components/auth";
import type { UnifiedUser } from "@/hooks/useAuth";

interface AuthButtonProps {
  user: UnifiedUser | null;
  isLoading: boolean;
  hasNostrExtension: boolean;
  onLoginAtproto: (handle: string) => Promise<void>;
  onLoginNostr: () => Promise<void>;
  onLoginMatrix: (userId: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  atproto: "Bluesky",
  nostr: "Nostr",
  matrix: "Matrix",
};

const AUTH_TYPE_ICONS: Record<string, React.ReactNode> = {
  nostr: <Zap className="h-3 w-3 text-amber-500" />,
  matrix: <Grid3X3 className="h-3 w-3 text-green-500" />,
};

export function AuthButton({
  user,
  isLoading,
  hasNostrExtension,
  onLoginAtproto,
  onLoginNostr,
  onLoginMatrix,
  onLogout,
}: AuthButtonProps) {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("bluesky");

  const handleAtprotoSubmit = async (handle: string) => {
    setIsSubmitting(true);
    try {
      await onLoginAtproto(handle);
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

  const handleMatrixSubmit = async (userId: string, password: string) => {
    setIsSubmitting(true);
    try {
      await onLoginMatrix(userId, password);
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
    const profilePath = user.authType === "atproto"
      ? `/profile/${user.handle}`
      : `/profile/${user.id}`;

    const displayId = user.authType === "atproto"
      ? `@${user.handle}`
      : user.id.length > 20
        ? `${user.id.slice(0, 16)}...`
        : user.id;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.displayName}</span>
            {AUTH_TYPE_ICONS[user.authType]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{displayId}</p>
            <p className="text-xs text-muted-foreground">
              {AUTH_TYPE_LABELS[user.authType]}
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bluesky">Bluesky</TabsTrigger>
              <TabsTrigger value="nostr" className="gap-1">
                <Zap className="h-3 w-3" />
                Nostr
              </TabsTrigger>
              <TabsTrigger value="matrix" className="gap-1">
                <Grid3X3 className="h-3 w-3" />
                Matrix
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bluesky" className="mt-4">
              <BlueskyLoginForm
                onSubmit={handleAtprotoSubmit}
                isSubmitting={isSubmitting}
              />
            </TabsContent>

            <TabsContent value="nostr" className="mt-4">
              <NostrLoginForm
                hasExtension={hasNostrExtension}
                onLogin={handleNostrLogin}
                isSubmitting={isSubmitting}
              />
            </TabsContent>

            <TabsContent value="matrix" className="mt-4">
              <MatrixLoginForm
                onSubmit={handleMatrixSubmit}
                isSubmitting={isSubmitting}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
