import type {ReactNode} from "react";

type Block =
  | {kind: "heading"; depth: number; text: string}
  | {kind: "paragraph"; text: string}
  | {kind: "list"; ordered: boolean; items: string[]};

/**
 * Render the limited Markdown syntax used by course descriptions without HTML
 * injection or a browser-side Markdown library. All content remains React text.
 */
function parseCourseCopy(source: string): Block[] {
  const result: Block[] = [];
  const paragraph: string[] = [];
  let list: {ordered: boolean; items: string[]} | null = null;

  function flushParagraph() {
    if (paragraph.length) {
      result.push({kind: "paragraph", text: paragraph.join(" ").trim()});
      paragraph.length = 0;
    }
  }
  function flushList() {
    if (list) result.push({kind: "list", ...list});
    list = null;
  }

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (heading && heading[2].length < 160) {
      flushParagraph();
      flushList();
      result.push({kind: "heading", depth: heading[1].length, text: heading[2]});
      continue;
    }
    const item = /^(?:(\d+)[.)]\s+|[-*•]\s+)(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      const ordered = Boolean(item[1]);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = {ordered, items: []};
      list.items.push(item[2]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return result;
}

function plainText(value: string): string {
  return value
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{1,3}/g, "")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/\\([*_#])/g, "$1");
}

export function courseExcerpt(source: string, maxCharacters = 160): string {
  const blocks = parseCourseCopy(source);
  // A heading on the detail page commonly repeats the card's course title.
  const first = blocks.find((block) => block.kind === "paragraph") ?? blocks[0];
  const text = plainText(first?.kind === "list" ? first.items.join(" ") : first?.text ?? "")
    .replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  return characters.length > maxCharacters
    ? characters.slice(0, Math.max(0, maxCharacters - 1)).join("").trimEnd() + "…"
    : text;
}

function inlineCopy(text: string): ReactNode[] {
  return plainText(text.replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1"))
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={index}>{part.slice(1, -1)}</em>;
      return part;
    });
}

export function CourseDescription({text}: {text: string | null | undefined}) {
  if (!text?.trim()) return null;
  return (
    <div className="space-y-4 leading-8 text-muted">
      {parseCourseCopy(text).map((block, index) => {
        if (block.kind === "heading") {
          const className = "font-semibold leading-relaxed text-ink " +
            (block.depth <= 2 ? "mt-7 text-xl" : "mt-5 text-base");
          return block.depth <= 2
            ? <h2 key={index} className={className}>{inlineCopy(block.text)}</h2>
            : <h3 key={index} className={className}>{inlineCopy(block.text)}</h3>;
        }
        if (block.kind === "paragraph")
          return <p key={index}>{inlineCopy(block.text)}</p>;
        const items = block.items.map((item, itemIndex) =>
          <li key={itemIndex} className="ps-1">{inlineCopy(item)}</li>
        );
        return block.ordered
          ? <ol key={index} className="list-decimal space-y-1 ps-6">{items}</ol>
          : <ul key={index} className="list-disc space-y-1 ps-6">{items}</ul>;
      })}
    </div>
  );
}
