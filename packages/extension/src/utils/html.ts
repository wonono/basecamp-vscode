const ALLOWED_TAGS = new Set([
  "div", "p", "span", "strong", "em", "b", "i", "u", "a", "br",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "pre",
  "code", "img", "table", "thead", "tbody", "tr", "td", "th", "hr",
  "figure", "figcaption", "dl", "dt", "dd", "abbr", "sub", "sup",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

/**
 * Sanitize Basecamp HTML content for safe rendering in a webview.
 * Strips dangerous tags/attributes, rewrites links for message-passing.
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let result = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // Remove style tags and their content
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  // Remove event handlers
  result = result.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  // Remove style attributes
  result = result.replace(/\s+style\s*=\s*"[^"]*"/gi, "");
  result = result.replace(/\s+style\s*=\s*'[^']*'/gi, "");
  // Remove iframes, objects, embeds, forms
  result = result.replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  result = result.replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, "");

  // Process remaining tags: strip disallowed tags, keep content
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) {
      return "";
    }

    // For closing tags
    if (match.startsWith("</")) {
      return `</${tagLower}>`;
    }

    // Filter attributes
    const allowedAttrSet = ALLOWED_ATTRS[tagLower];
    if (!allowedAttrSet || !attrs.trim()) {
      return `<${tagLower}>`;
    }

    const filteredAttrs: string[] = [];
    const attrRegex = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4];

      if (!allowedAttrSet.has(attrName)) continue;

      // Validate href/src: only allow https and mailto
      if (attrName === "href" || attrName === "src") {
        if (
          !attrValue.startsWith("https://") &&
          !attrValue.startsWith("mailto:") &&
          !attrValue.startsWith("#")
        ) {
          continue;
        }
      }

      filteredAttrs.push(`${attrName}="${escapeAttr(attrValue)}"`);
    }

    const attrStr = filteredAttrs.length > 0 ? " " + filteredAttrs.join(" ") : "";
    return `<${tagLower}${attrStr}>`;
  });

  // Rewrite <a> tags to open externally
  result = result.replace(
    /<a\b([^>]*)>/gi,
    '<a$1 class="external-link" data-external="true">'
  );

  return result;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Strip all HTML tags and return plain text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}
