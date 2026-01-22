import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { AuthButton } from "@/components/AuthButton";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { FileCode } from "lucide-react";

interface PageHeaderProps {
  showBackToHome?: boolean;
}

export function PageHeader({ showBackToHome = true }: PageHeaderProps) {
  const { user, isLoading, login, logout } = useAtprotoAuth();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Source of Clarity" className="h-8 w-8" />
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg text-foreground">Source of Clarity</h1>
            <p className="text-xs text-muted-foreground">
              Discuss smart contracts on the Stacks blockchain.
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/contracts"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileCode className="h-4 w-4" />
            <span className="hidden sm:inline">Browse Contracts</span>
          </Link>
          <AuthButton
            user={user}
            isLoading={isLoading}
            onLogin={login}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  );
}

export default PageHeader;
