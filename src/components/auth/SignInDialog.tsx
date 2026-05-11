import { useState } from "react";
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
  ArrowLeft,
  ExternalLink,
  Key,
  Link2,
  Loader2,
  Zap,
} from "lucide-react";

export type SignInMethod =
  | "nostr-extension"
  | "nostr-nsec"
  | "nostr-bunker"
  | "bluesky";

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
  shortLabel: string;
  icon: React.ReactNode;
  tagline: string;
  detailTitle: string;
  detailDescription: string;
  inputLabel: string | null;
  inputType: "text" | "password";
  placeholder: string;
  helper: string;
  submitLabel: string;
}

const BlueskyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 57" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"
    />
  </svg>
);

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
  const [method, setMethod] = useState<SignInMethod | null>(null);
  const [value, setValue] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods: MethodConfig[] = [
    {
      value: "nostr-extension",
      label: "Continue with Nostr extension",
      shortLabel: "Nostr extension",
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      tagline: "One click, keys stay in your extension",
      detailTitle: "Sign in with your Nostr extension",
      detailDescription: hasNostrExtension
        ? "We'll ask your NIP-07 extension to approve the sign-in. Your keys never leave it."
        : "No NIP-07 extension detected. Install Alby or nos2x, then come back.",
      inputLabel: null,
      inputType: "text",
      placeholder: "",
      helper: "Tip: Alby and nos2x are great choices.",
      submitLabel: "Approve in extension",
    },
    {
      value: "nostr-bunker",
      label: "Continue with a remote signer (Bunker)",
      shortLabel: "Bunker",
      icon: <Link2 className="h-4 w-4 text-amber-500" />,
      tagline: "Use nsec.app, Amber, or any NIP-46 signer",
      detailTitle: "Connect a remote signer",
      detailDescription:
        "Paste a bunker URL or your NIP-05 identifier. You'll approve the connection in your signer app.",
      inputLabel: "Bunker URL or NIP-05",
      inputType: "text",
      placeholder: "bunker://… or alice@nsec.app",
      helper: "We'll open your signer to authorize this app.",
      submitLabel: "Connect",
    },
    {
      value: "bluesky",
      label: "Continue with Bluesky",
      shortLabel: "Bluesky",
      icon: <BlueskyIcon className="h-4 w-4 text-sky-500" />,
      tagline: "Sign in with your AT Protocol handle",
      detailTitle: "Sign in with Bluesky",
      detailDescription:
        "Enter your handle and we'll redirect you to your PDS to approve.",
      inputLabel: "Your handle",
      inputType: "text",
      placeholder: "alice.bsky.social",
      helper: "Use your full handle, including the domain.",
      submitLabel: "Continue",
    },
    {
      value: "nostr-nsec",
      label: "Use a private key (nsec)",
      shortLabel: "Private key",
      icon: <Key className="h-4 w-4 text-muted-foreground" />,
      tagline: "Advanced — least secure",
      detailTitle: "Sign in with a private key",
      detailDescription:
        "Paste your nsec to sign in directly in this browser. Stored locally only.",
      inputLabel: "Private key",
      inputType: "password",
      placeholder: "nsec1…",
      helper: "Prefer an extension or bunker for valuable keys.",
      submitLabel: "Sign in",
    },
  ];

  const current = method ? methods.find((m) => m.value === method)! : null;

  const reset = () => {
    setMethod(null);
    setValue("");
    setError(null);
    setAuthUrl(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const goBack = () => {
    setValue("");
    setError(null);
    setAuthUrl(null);
    setMethod(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || isSubmitting) return;
    if (current.inputLabel && !value.trim()) return;
    if (current.value === "nostr-extension" && !hasNostrExtension) return;

    setError(null);
    setAuthUrl(null);
    try {
      const trimmed = value.trim();
      switch (current.value) {
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm sm:max-w-md p-5 sm:p-6 gap-5 transition-all duration-300">
        {!current ? (
          <div key="picker" className="flex flex-col gap-5 animate-in fade-in-0 slide-in-from-left-4 duration-300 ease-out">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-2xl">Welcome 👋</DialogTitle>
              <DialogDescription>
                Sign in to comment, react, and follow other reviewers.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              {methods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    {m.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium leading-tight">
                      {m.label}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {m.tagline}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              No account needed — bring your decentralized identity.
            </p>
          </div>
        ) : (
          <div key="detail" className="flex flex-col gap-5 animate-in fade-in-0 slide-in-from-right-4 duration-300 ease-out">
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit disabled:opacity-50 -mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Other sign-in options
            </button>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl flex items-center gap-2.5 pt-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  {current.icon}
                </span>
                {current.detailTitle}
              </DialogTitle>
              <DialogDescription>{current.detailDescription}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {current.inputLabel ? (
                <div className="space-y-1.5">
                  <Label htmlFor="signin-input">{current.inputLabel}</Label>
                  <Input
                    id="signin-input"
                    type={current.inputType}
                    autoComplete="off"
                    autoFocus
                    placeholder={current.placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {current.helper}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  {current.helper}
                </div>
              )}

              {(error || authUrl) && (
                <div className="text-xs">
                  {error && (
                    <p className="text-destructive break-words">{error}</p>
                  )}
                  {authUrl && !error && (
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline inline-flex items-center gap-1 break-all"
                    >
                      <ExternalLink className="h-3 w-3" /> Open authorization
                      page
                    </a>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isSubmitting ||
                  (current.inputLabel !== null && !value.trim()) ||
                  (current.value === "nostr-extension" && !hasNostrExtension)
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  current.submitLabel
                )}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
