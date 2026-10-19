// Import the inner file: the package root runs a debug routine on import.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/** Returns an array of strings, one per PDF page. */
export async function extractPages(buffer, mimetype = 'application/pdf') {
  if (mimetype === 'text/plain') {
    // Treat every ~3000 characters of a text file as a "page".
    const text = buffer.toString('utf8');
    const pages = [];
    for (let i = 0; i < text.length; i += 3000) pages.push(text.slice(i, i + 3000));
    return pages;
  }
  const pages = [];
  await pdfParse(buffer, {
    // pdf-parse awaits each page in order, so pages[] stays aligned with page numbers.
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((item) => item.str).join(' ');
      pages.push(text);
      return text;
    },
  });
  return pages;
}
