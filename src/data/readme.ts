const ABSOLUTE = /^(?:https?:)?\/\/|^#|^mailto:|^data:|^obsidian:/i;

function stripLeadingDot(url: string): string {
  return url.replace(/^\.?\//, "");
}

/** Rewrite relative URLs in a GitHub README so images and links resolve:
 * images → raw.githubusercontent.com, links → github.com blob view. */
export function rewriteReadmeUrls(markdown: string, repo: string): string {
  const rawBase = `https://raw.githubusercontent.com/${repo}/HEAD/`;
  const blobBase = `https://github.com/${repo}/blob/HEAD/`;

  return markdown
    // Markdown images: ![alt](url)
    .replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (m, pre: string, url: string, post: string) =>
      ABSOLUTE.test(url) ? m : pre + rawBase + stripLeadingDot(url) + post
    )
    // Markdown links: [text](url) — negative lookbehind excludes images
    .replace(/((?<!!)\[[^\]]*\]\()([^)\s]+)(\))/g, (m, pre: string, url: string, post: string) =>
      ABSOLUTE.test(url) ? m : pre + blobBase + stripLeadingDot(url) + post
    )
    // Inline HTML images: <img src="url">
    .replace(/(<img[^>]*\ssrc=")([^"]+)(")/gi, (m, pre: string, url: string, post: string) =>
      ABSOLUTE.test(url) ? m : pre + rawBase + stripLeadingDot(url) + post
    );
}
