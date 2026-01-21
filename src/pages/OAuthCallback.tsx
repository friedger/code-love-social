import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleCallback, getSession } from "@/lib/atproto-auth";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Check for error in URL params
        const url = new URL(window.location.href);
        const urlError = url.searchParams.get("error");
        if (urlError) {
          const errorDesc = url.searchParams.get("error_description") || urlError;
          throw new Error(errorDesc);
        }

        // Handle the callback - this extracts and stores the session token
        const sessionToken = handleCallback();
        
        if (sessionToken) {
          // Verify the session works
          const user = await getSession();
          if (user) {
            // Success - redirect to home
            navigate("/", { replace: true });
            return;
          }
        }
        
        // If we get here without a session, something went wrong
        throw new Error("Authentication failed - no session received");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    processCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Authentication Failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-primary underline hover:no-underline"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
