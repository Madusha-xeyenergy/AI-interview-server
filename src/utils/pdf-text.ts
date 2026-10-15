import { extractText, getDocumentProxy } from "unpdf";

/** Returns all text in a PDF as one string, with runs of whitespace collapsed. */
const extractPdfText = async (buffer: Buffer) => {
  // pdf.js needs a plain Uint8Array copy; it detaches the buffer it is given.
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  return text.replace(/\s+/g, " ").trim();
};

export { extractPdfText };
