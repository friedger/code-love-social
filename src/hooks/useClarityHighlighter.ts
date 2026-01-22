import { useState, useEffect, useCallback } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import clarityGrammar from "@/lib/clarity.tmLanguage.json";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighterInstance(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        {
          name: "clarity",
          scopeName: "source.clar",
          patterns: clarityGrammar.patterns,
          repository: clarityGrammar.repository,
        },
      ],
    });
  }
  return highlighterPromise;
}

export interface HighlightedToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export interface HighlightedLine {
  tokens: HighlightedToken[];
}

export function useClarityHighlighter() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getHighlighterInstance().then((h) => {
      setHighlighter(h);
      setIsReady(true);
    });
  }, []);

  const highlightLines = useCallback(
    (code: string, theme: "light" | "dark"): HighlightedLine[] => {
      if (!highlighter) {
        // Return plain tokens when highlighter isn't ready
        return code.split("\n").map((line) => ({
          tokens: [{ content: line, color: undefined, fontStyle: undefined }],
        }));
      }

      const result = highlighter.codeToTokens(code, {
        lang: "clarity",
        theme: theme === "dark" ? "github-dark" : "github-light",
      });

      return result.tokens.map((lineTokens) => ({
        tokens: lineTokens,
      }));
    },
    [highlighter]
  );

  return { highlightLines, isReady };
}
