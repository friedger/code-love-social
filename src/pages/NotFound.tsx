import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img 
            src={logo} 
            alt="Source of Clarity" 
            className="h-20 w-20 opacity-50 grayscale"
          />
        </div>
        
        {/* Error Message */}
        <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Contract Not Found</h2>
        <p className="mb-8 text-muted-foreground">
          The page you're looking for doesn't exist or may have been moved. 
          Perhaps the contract was never deployed?
        </p>
        
        {/* Navigation Options */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="default">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <Search className="mr-2 h-4 w-4" />
              Search Contracts
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
        
        {/* Attempted Path */}
        <p className="mt-8 text-xs text-muted-foreground">
          Attempted path: <code className="rounded bg-muted px-2 py-1">{location.pathname}</code>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
