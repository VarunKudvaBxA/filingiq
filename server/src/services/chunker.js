/**
 * Splits page texts into overlapping word windows. Each chunk remembers its page
 * number so answers can cite "page 42" later.
 */
export function chunkPages(pages, { size = 180, overlap = 30 } = {}) {
  if (overlap >= size) throw new Error('overlap must be smaller than size');
  const chunks = [];
  pages.forEach((pageText, index) => {
    const words = pageText.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) return;
    for (let start = 0; start < words.length; start += size - overlap) {
      const slice = words.slice(start, start + size);
      // A very short tail is already covered by the previous chunk's overlap.
      if (slice.length < 20 && start > 0) break;
      chunks.push({ page: index + 1, text: slice.join(' ') });
      if (start + size >= words.length) break;
    }
  });
  return chunks;
}
