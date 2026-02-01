import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { FileCode, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageHeaderProps {
  showBackToHome?: boolean;
}

export function PageHeader({ showBackToHome = true }: PageHeaderProps) {
  const { user, isLoading, hasNostrExtension, loginWithAtproto, loginWithNostr, loginWithMatrix, logout } = useAuth();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <img src={logo} alt="Source of Clarity" className="h-7 w-7 sm:h-8 sm:w-8" />
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg text-foreground">Source of Clarity</h1>
            <p className="text-xs text-muted-foreground">
              Discuss smart contracts on the Stacks blockchain.
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/contracts"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileCode className="h-4 w-4" />
              <span>Browse Contracts</span>
            </Link>
            {user && (
              <Link
                to="/add-contract"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Contract</span>
              </Link>
            )}
          </div>

          {/* Mobile hamburger menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/contracts" className="flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Browse Contracts
                  </Link>
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem asChild>
                    <Link to="/add-contract" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Contract
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AuthButton
            user={user}
            isLoading={isLoading}
            hasNostrExtension={hasNostrExtension}
            onLoginAtproto={loginWithAtproto}
            onLoginNostr={loginWithNostr}
            onLoginMatrix={loginWithMatrix}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  );
}

export default PageHeader;
