/**
 * HTML to readable text.
 *
 * This existed in three places with the good version buried in lib/gmail. The two
 * copies in the ingest paths collapsed all whitespace to single spaces and did not
 * convert `<br>` or closing block tags to newlines, so a job description arrived at
 * the enrichment prompt as one unbroken line. That prompt is trying to read
 * requirement bullets out of it for levelSignals and applicationNeeds, and a wall
 * of text is measurably worse input for that than a list.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Block boundaries become newlines, so lists stay lists.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|ul|ol|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    // Collapse runs of spaces and tabs but keep newlines.
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
