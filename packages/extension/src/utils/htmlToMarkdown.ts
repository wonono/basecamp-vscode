/**
 * Convert Basecamp HTML content to Markdown.
 * Covers the tag set used by Basecamp's rich text editor.
 * Zero dependencies — regex-based for the limited HTML subset.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let md = html;

  // Remove script/style tags entirely
  md = md.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  md = md.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Block elements first (order matters)

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n# ${inline(c)}\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n## ${inline(c)}\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n### ${inline(c)}\n`);
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n#### ${inline(c)}\n`);

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => {
    const text = htmlToMarkdown(c).trim();
    return "\n" + text.split("\n").map((l: string) => `> ${l}`).join("\n") + "\n";
  });

  // Fenced code blocks
  md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, c) => {
    return `\n\`\`\`\n${decodeEntities(c).trim()}\n\`\`\`\n`;
  });
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
    return `\n\`\`\`\n${decodeEntities(c).trim()}\n\`\`\`\n`;
  });

  // Lists — unordered
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return "\n" + convertList(content, "ul") + "\n";
  });

  // Lists — ordered
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    return "\n" + convertList(content, "ol") + "\n";
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `\n${inline(c)}\n`);

  // Divs (Basecamp wraps lines in divs)
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, c) => `\n${inline(c)}`);

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Inline elements
  // Images (before links, since img can be inside a)
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, "![$1]($2)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = stripTags(text).trim();
    return `[${cleanText}](${href})`;
  });

  // Bold
  md = md.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, c) => `**${inline(c)}**`);

  // Italic
  md = md.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __ ,c) => `*${inline(c)}*`);

  // Underline (no Markdown equivalent, use emphasis)
  md = md.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, (_, c) => `_${inline(c)}_`);

  // Inline code
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decodeEntities(c)}\``);

  // Figure/figcaption
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (_, c) => htmlToMarkdown(c));
  md = md.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, c) => `\n*${inline(c)}*\n`);

  // Tables (best-effort)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, c) => convertTable(c));

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = decodeEntities(md);

  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

function inline(html: string): string {
  // Process inline elements within a block, strip remaining block tags
  let result = html;
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  result = result.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  result = result.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, "_$2_");
  result = result.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  result = result.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  result = result.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");
  result = result.replace(/<[^>]+>/g, "");
  return decodeEntities(result).trim();
}

function convertList(html: string, type: "ul" | "ol"): string {
  const items: string[] = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let idx = 1;
  while ((match = re.exec(html)) !== null) {
    const content = htmlToMarkdown(match[1]).trim();
    const prefix = type === "ol" ? `${idx++}. ` : "- ";
    // Indent continuation lines
    const lines = content.split("\n");
    const indented = lines.map((l, i) => i === 0 ? `${prefix}${l}` : `  ${l}`).join("\n");
    items.push(indented);
  }
  return items.join("\n");
}

function convertTable(html: string): string {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(inline(cellMatch[2]));
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map(r => r.length));
  const lines: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const padded = rows[i].concat(Array(colCount - rows[i].length).fill(""));
    lines.push("| " + padded.join(" | ") + " |");
    if (i === 0) {
      lines.push("| " + padded.map(() => "---").join(" | ") + " |");
    }
  }

  return "\n" + lines.join("\n") + "\n";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
