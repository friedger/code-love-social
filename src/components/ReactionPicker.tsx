import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '🚀', '⚠️'] as const;

interface ReactionPickerProps {
  reactions: Record<string, number>;
  userReaction?: { emoji: string; uri: string };
  onReact: (emoji: string) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function ReactionPicker({ 
  reactions, 
  userReaction, 
  onReact, 
  disabled = false,
  size = "default"
}: ReactionPickerProps) {
  const hasReactions = Object.keys(reactions).length > 0;
  const buttonSize = size === "sm" ? "h-6 w-6 p-0" : "h-7 w-7 p-0";
  const emojiSize = size === "sm" ? "text-sm" : "text-lg";
  const countSize = size === "sm" ? "text-[10px]" : "text-xs";
  const pillPadding = size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Existing reaction counts as clickable pills */}
      {Object.entries(reactions).map(([emoji, count]) => {
        const isUserReaction = userReaction?.emoji === emoji;
        return (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-0.5 rounded transition-colors",
              pillPadding,
              countSize,
              isUserReaction 
                ? "bg-primary/20 text-primary ring-1 ring-primary/30" 
                : "bg-muted/50 hover:bg-muted text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span>{emoji}</span>
            <span className="text-muted-foreground">{count}</span>
          </button>
        );
      })}

      {/* Add reaction button with popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(buttonSize, "text-muted-foreground hover:text-foreground")}
            disabled={disabled}
          >
            <SmilePlus className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => {
              const isUserReaction = userReaction?.emoji === emoji;
              return (
                <button
                  key={emoji}
                  className={cn(
                    "p-1.5 hover:bg-muted rounded",
                    emojiSize,
                    isUserReaction && "bg-primary/20 ring-1 ring-primary/30"
                  )}
                  onClick={() => onReact(emoji)}
                  disabled={disabled}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { REACTION_EMOJIS };
export default ReactionPicker;

