import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Key, Link2, Loader2, Zap } from "lucide-react";

export type SignInMethod = "nostr-extension" | "nostr-nsec" | "nostr-bunker" | "bluesky";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasNostrExtension: boolean;
  isSubmitting: boolean;
  onLoginAtproto: (handle: string) => Promise<void>;
  onLoginNostr: () => Promise<void>;
  onLoginNostrNsec: (nsec: string) => Promise<void>;
  onLoginNostrBunker: (
    input: string,
    onauth?: (url: string) => void,
  ) => Promise<void>;
}

interface MethodConfig {
  value: SignInMethod;
  label: string;
  icon: React.ReactNode;
  description: string;
  inputLabel: string | null;
  inputType: "text" | "password";
  placeholder: string;
  helper: React.ReactNode;
  submitLabel: string;
  submitIcon: React.ReactNode;
}

export function SignInDialog({
  open,
  onOpenChange,
  hasNostrExtension,
  isSubmitting,
  onLoginAtproto,
  onLoginNostr,
  onLoginNostrNsec,
  onLoginNostrBunker,
}: SignInDialogProps) {
  const [method, setMethod] = useState<SignInMethod>("nostr-extension");
  const [value, setValue] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods: MethodConfig[] = useMemo(
    () => [
      {
        value: "nostr-extension",
        label: "Nostr — Extension",
        icon: <Zap className="h-4 w-4 text-amber-500" />,
        description: hasNostrExtension
          ? "Sign in using your installed NIP-07 browser extension."
          : "No NIP-07 extension detected. Install Alby or nos2x, or pick another method.",
        inputLabel: null,
        inputType: "text",
        placeholder: "",
        helper: (
          <span className="text-xs text-muted-foreground">
            Recommended. Keys never leave your extension.
          </span>
        ),
        submitLabel: "Sign in with Extension",
        submitIcon: <Zap className="h-4 w-4 mr-2" />,
      },
      {
        value: "nostr-nsec",
        label: "Nostr — Private key (nsec)",
        icon: <Key className="h-4 w-4 text-amber-500" />,
        description: "Paste your nsec to sign in directly in this browser.",
        inputLabel: "Private key",
        inputType: "password",
        placeholder: "nsec1...",
        helper: (
          <span className="text-xs text-muted-foreground">
            Least secure — prefer an extension or bunker for valuable keys.
          </span>
        ),
        submitLabel: "Sign in with nsec",
        submitIcon: <Key className="h-4 w-4 mr-2" />,
      },
      {
        value: "nostr-bunker",
        label: "Nostr — Bunker (NIP-46)",
        icon: <Link2 className="h-4 w-4 text-amber-500" />,
        description: "Connect a remote signer like nsec.app or Amber.",
        inputLabel: "Bunker URL or NIP-05",
        inputType: "text",
        placeholder: "bunker://... or name@domain.com",
        helper: (
          <span className="text-xs text-muted-foreground">
            You may need to authorize this app in your bunker.
          </span>
        ),
        submitLabel: "Connect bunker",
        submitIcon: <Link2 className="h-4 w-4 mr-2" />,
      },
      {
        value: "bluesky",
        label: "Bluesky",
        icon: <span className="text-sm">🦋</span>,
        description: "Sign in with your Bluesky / AT Protocol handle.",
        inputLabel: "Handle",
        inputType: "text",
        placeholder: "yourname.bsky.social",
        helper: (
          <span className="text-xs text-muted-foreground">
            Enter your full handle (e.g. alice.bsky.social).
          </span>
        ),
        submitLabel: "Continue with Bluesky",
        submitIcon: <span className="mr-2">🦋</span>,
      },
    ],
    [hasNostrExtension],
  );

  const current = methods.find((m) => m.value === method)!;
  const requiresInput = current.inputLabel !== null;
  const canSubmit =
    !isSubmitting &&
    (!requiresInput || value.trim().length > 0) &&
    (current.value !== "nostr-extension" || hasNostrExtension);

  const handleMethodChange = (next: string) => {
    setMethod(next as SignInMethod);
    setValue("");
    setError(null);
    setAuthUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setAuthUrl(null);
    try {
      const trimmed = value.trim();
      switch (method) {
        case "nostr-extension":
          await onLoginNostr();
          break;
        case "nostr-nsec":
          await onLoginNostrNsec(trimmed);
          break;
        case "nostr-bunker":
          await onLoginNostrBunker(trimmed, (url) => {
            setAuthUrl(url);
            try {
              window.open(url, "_blank", "noopener,noreferrer");
            } catch {
              // popup blocked — link rendered below
            }
          });
          break;
        case "bluesky":
          await onLoginAtproto(trimmed);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm sm:max-w-md p-4 sm:p-6 gap-4">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Choose your preferred authentication method.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-method">Method</Label>
            <Select value={method} onValueChange={handleMethodChange}>
              <SelectTrigger id="signin-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      {m.icon}
                      {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground min-h-[2.5rem]">
            {current.description}
          </p>

          <div className="space-y-1.5 min-h-[5.25rem]">
            {requiresInput ? (
              <>
                <Label htmlFor="signin-input">{current.inputLabel}</Label>
                <Input
                  id="signin-input"
                  type={current.inputType}
                  autoComplete="off"
                  placeholder={current.placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSubmitting}
                />
                {current.helper}
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground min-h-[5.25rem] flex items-center">
                {current.helper}
              </div>
            )}
          </div>

          <div className="min-h-[1.25rem] text-xs">
            {error && <p className="text-destructive break-words">{error}</p>}
            {authUrl && !error && (
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1 break-all"
              >
                <ExternalLink className="h-3 w-3" /> Open authorization page
              </a>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                {current.submitIcon}
                {current.submitLabel}
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
