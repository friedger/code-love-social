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
import { users, User } from "@/data/dummyUsers";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

interface AuthButtonProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export function AuthButton({ currentUser, onLogin, onLogout }: AuthButtonProps) {
  const [showLoginMenu, setShowLoginMenu] = useState(false);

  if (currentUser) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>{currentUser.displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{currentUser.displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{currentUser.displayName}</p>
            <p className="text-xs text-muted-foreground">@{currentUser.handle}</p>
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
    <DropdownMenu open={showLoginMenu} onOpenChange={setShowLoginMenu}>
      <DropdownMenuTrigger asChild>
        <Button>
          <LogIn className="h-4 w-4 mr-2" /> Sign in with AT Protocol
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Demo: Select a user</p>
          <p className="text-xs text-muted-foreground">In production, this uses AT Protocol OAuth</p>
        </div>
        <DropdownMenuSeparator />
        {users.map((user) => (
          <DropdownMenuItem
            key={user.did}
            onClick={() => {
              onLogin(user);
              setShowLoginMenu(false);
            }}
          >
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">@{user.handle}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
