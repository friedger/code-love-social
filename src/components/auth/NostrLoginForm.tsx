import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";

interface NostrLoginFormProps {
  hasExtension: boolean;
  onLogin: () => Promise<void>;
  isSubmitting: boolean;
}

export function NostrLoginForm({ hasExtension, onLogin, isSubmitting }: NostrLoginFormProps) {
  if (!hasExtension) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign in using your Nostr browser extension (NIP-07).
      </p>
      <Button
        className="w-full"
        onClick={onLogin}
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
    </div>
  );
}
