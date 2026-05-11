import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Zap, Key, Link2, ExternalLink } from "lucide-react";

interface NostrLoginFormProps {
  hasExtension: boolean;
  onLogin: () => Promise<void>;
  onLoginNsec: (nsec: string) => Promise<void>;
  onLoginBunker: (
    input: string,
    onauth: (url: string) => void,
  ) => Promise<void>;
  isSubmitting: boolean;
}

export function NostrLoginForm({
  hasExtension,
  onLogin,
  onLoginNsec,
  onLoginBunker,
  isSubmitting,
}: NostrLoginFormProps) {
  const [mode, setMode] = useState<string>(hasExtension ? "extension" : "bunker");
  const [nsec, setNsec] = useState("");
  const [bunkerInput, setBunkerInput] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleNsec = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await onLoginNsec(nsec.trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleBunker = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setAuthUrl(null);
    try {
      await onLoginBunker(bunkerInput.trim(), (url) => {
        setAuthUrl(url);
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          // If popup blocked, the link is still rendered below.
        }
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <Tabs value={mode} onValueChange={setMode} className="w-full flex flex-col flex-1">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="extension" className="gap-1">
          <Zap className="h-3 w-3" /> Extension
        </TabsTrigger>
        <TabsTrigger value="nsec" className="gap-1">
          <Key className="h-3 w-3" /> nsec
        </TabsTrigger>
        <TabsTrigger value="bunker" className="gap-1">
          <Link2 className="h-3 w-3" /> Bunker
        </TabsTrigger>
      </TabsList>

      {/* Extension */}
      <TabsContent value="extension" className="mt-4 space-y-4 min-h-[260px] flex flex-col">
        {!hasExtension ? (
          <div className="text-center space-y-3 py-4">
            <Zap className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No Nostr extension detected.
            </p>
            <p className="text-xs text-muted-foreground">
              Install a NIP-07 extension like{" "}
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
                href="https://github.com/fiatjaf/nos2x"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                nos2x
              </a>
              , or use nsec / bunker instead.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Sign in using your Nostr browser extension (NIP-07).
            </p>
            <Button
              className="w-full mt-auto"
              onClick={onLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" /> Sign in with Extension
                </>
              )}
            </Button>
          </>
        )}
      </TabsContent>

      {/* nsec */}
      <TabsContent value="nsec" className="mt-4 space-y-4 min-h-[260px] flex flex-col">
        <form onSubmit={handleNsec} className="space-y-3 flex flex-col flex-1">
          <div className="space-y-1.5">
            <Label htmlFor="nsec-input">Private key (nsec)</Label>
            <Input
              id="nsec-input"
              type="password"
              autoComplete="off"
              placeholder="nsec1..."
              value={nsec}
              onChange={(e) => setNsec(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Stored locally in this browser. Least secure option — prefer an
              extension or bunker for valuable keys.
            </p>
          </div>
          {localError && (
            <p className="text-xs text-destructive">{localError}</p>
          )}
          <Button
            type="submit"
            className="w-full mt-auto"
            disabled={isSubmitting || !nsec.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" /> Sign in with nsec
              </>
            )}
          </Button>
        </form>
      </TabsContent>

      {/* bunker */}
      <TabsContent value="bunker" className="mt-4 space-y-4 min-h-[260px] flex flex-col">
        <form onSubmit={handleBunker} className="space-y-3 flex flex-col flex-1">
          <div className="space-y-1.5">
            <Label htmlFor="bunker-input">Bunker URL or NIP-05</Label>
            <Input
              id="bunker-input"
              type="text"
              autoComplete="off"
              placeholder="bunker://... or name@domain.com"
              value={bunkerInput}
              onChange={(e) => setBunkerInput(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Connect to a remote NIP-46 signer (e.g. nsec.app, Amber).
            </p>
          </div>
          {authUrl && (
            <div className="rounded-md border border-border p-2 text-xs space-y-1">
              <p className="text-muted-foreground">
                Authorize this app in your bunker:
              </p>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1 break-all"
              >
                <ExternalLink className="h-3 w-3" /> Open authorization page
              </a>
            </div>
          )}
          {localError && (
            <p className="text-xs text-destructive">{localError}</p>
          )}
          <Button
            type="submit"
            className="w-full mt-auto"
            disabled={isSubmitting || !bunkerInput.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> Connect bunker
              </>
            )}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
