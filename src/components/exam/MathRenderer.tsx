"use client";

import { memo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/contrib/mhchem";

interface MathRendererProps {
  text: string;
  className?: string;
}

type MathPart =
  | { type: "text"; content: string }
  | { type: "inline-math"; content: string }
  | { type: "block-math"; content: string };

export const MathRenderer = memo(function MathRenderer({
  text,
  className,
}: MathRendererProps) {
  if (!text) return null;

  const parts = splitMath(text);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "block-math") {
          return (
            <span key={`math-block-${index}`} className="my-2 block overflow-x-auto">
              <BlockMath
                math={part.content}
                renderError={() => (
                  <span className="font-mono text-xs text-red-500">{part.content}</span>
                )}
              />
            </span>
          );
        }

        if (part.type === "inline-math") {
          return (
            <InlineMath
              key={`math-inline-${index}`}
              math={part.content}
              renderError={() => (
                <span className="font-mono text-xs text-red-500">${part.content}$</span>
              )}
            />
          );
        }

        return (
          <span key={`math-text-${index}`} className="whitespace-pre-wrap">
            {part.content}
          </span>
        );
      })}
    </span>
  );
});

function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  const regex = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$([^\n$]+?)(?<!\\)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      parts.push({ type: "block-math", content: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline-math", content: match[2] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}
