import type { HighlightedToken } from "@/hooks/useClarityHighlighter";

interface HighlightedCodeLineProps {
  tokens: HighlightedToken[];
}

export function HighlightedCodeLine({ tokens }: HighlightedCodeLineProps) {
  return (
    <>
      {tokens.map((token, i) => (
        <span
          key={i}
          style={{
            color: token.color,
            fontStyle: token.fontStyle === 1 ? "italic" : undefined,
            fontWeight: token.fontStyle === 2 ? "bold" : undefined,
          }}
        >
          {token.content}
        </span>
      ))}
    </>
  );
}
