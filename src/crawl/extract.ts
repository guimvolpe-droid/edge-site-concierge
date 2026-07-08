// HTML → plain text — pure, no DOM. Good enough for content pages: strips the chrome
// (scripts, styles, nav, header, footer, aside), turns tags into whitespace, decodes the
// common entities, and collapses runs of whitespace. Pages rendered entirely by JavaScript
// yield little or no text — a documented limitation (see ADR 0003).

const DROP = /<(script|style|noscript|template|svg|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (e) => ENTITIES[e] ?? e)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(TITLE.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const body = html
    .replace(COMMENTS, " ")
    .replace(DROP, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body).replace(/\s+/g, " ").trim();
  return { title, text };
}
