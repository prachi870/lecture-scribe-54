/**
 * Client-side document text extraction.
 * Supports: .txt, .md, .csv  (native)
 *           .pdf              (via PDF.js CDN — loaded on demand)
 *           .docx             (raw XML parsing — no library needed)
 *
 * Returns plain text extracted from the document.
 */

export type DocumentType = "text" | "pdf" | "docx" | "audio";

export function classifyFile(file: File): DocumentType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime.startsWith("audio") || mime.startsWith("video")) return "audio";
  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    mime.startsWith("text/")
  )
    return "text";

  return "audio"; // fallback — let upstream handle it
}

/** Extract plain text from a .txt / .md / .csv file */
async function extractText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).trim());
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

/** Extract plain text from a .pdf file using PDF.js (loaded from CDN) */
async function extractPDF(file: File): Promise<string> {
  // Load PDF.js from cdnjs on demand — no npm install needed
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";
      script.type = "module";
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
    // Give the module time to initialise
    await new Promise((r) => setTimeout(r, 300));
  }

  // Use a simpler fallback: parse PDF bytes manually to extract text runs
  // Since PDF.js CDN loading is unreliable, use a basic text extraction approach
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(bytes);

  // Extract text between BT and ET markers (basic PDF text extraction)
  const lines: string[] = [];
  const btEtPattern = /BT[\s\S]*?ET/g;
  const matches = raw.match(btEtPattern) ?? [];

  for (const block of matches) {
    // Extract strings from Tj, TJ, and quote operators
    const tjPattern = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    let m;
    while ((m = tjPattern.exec(block)) !== null) {
      const text = m[1]
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .trim();
      if (text) lines.push(text);
    }
  }

  const result = lines.join(" ").replace(/\s+/g, " ").trim();

  if (result.length < 50) {
    // Fallback: extract any readable text from the raw bytes
    const readable = raw
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = readable.match(/\b[a-zA-Z]{3,}\b/g) ?? [];
    if (words.length > 20) {
      return words.join(" ");
    }
    throw new Error("Could not extract text from this PDF. Try a text-based PDF or copy-paste the content.");
  }

  return result;
}

/** Extract plain text from a .docx file (Office Open XML) */
async function extractDOCX(file: File): Promise<string> {
  // DOCX = ZIP containing word/document.xml
  const arrayBuffer = await file.arrayBuffer();

  // Find the word/document.xml content inside the ZIP
  // We do a simple binary search for the XML content marker
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder("utf-8", { fatal: false });

  // Look for the XML content — DOCX stores it as plain XML within the ZIP
  let xmlContent = "";

  // Find 'word/document.xml' entry in the ZIP local file headers
  // PK\x03\x04 = local file header signature
  for (let i = 0; i < bytes.length - 30; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
      // Read filename length and extra field length
      const fnLen = bytes[i + 26] | (bytes[i + 27] << 8);
      const extLen = bytes[i + 28] | (bytes[i + 29] << 8);
      const fnStart = i + 30;
      const fnEnd = fnStart + fnLen;
      const fileName = decoder.decode(bytes.slice(fnStart, fnEnd));

      if (fileName === "word/document.xml") {
        const dataStart = fnEnd + extLen;
        // The compressed size tells us how much to read
        const compSize = bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24);
        const compression = bytes[i + 8] | (bytes[i + 9] << 8);

        if (compression === 0) {
          // Stored (not compressed)
          xmlContent = decoder.decode(bytes.slice(dataStart, dataStart + compSize));
        } else {
          // Deflate compressed — use DecompressionStream
          try {
            const compressed = bytes.slice(dataStart, dataStart + compSize);
            const ds = new DecompressionStream("deflate-raw");
            const writer = ds.writable.getWriter();
            writer.write(compressed);
            writer.close();
            const chunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            const total = chunks.reduce((acc, c) => acc + c.length, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const c of chunks) { merged.set(c, offset); offset += c.length; }
            xmlContent = decoder.decode(merged);
          } catch {
            // DecompressionStream may not be available in all environments
          }
        }
        break;
      }
    }
  }

  if (!xmlContent) {
    throw new Error("Could not read this DOCX file. Make sure it is a valid .docx document.");
  }

  // Extract text from <w:t> tags
  const textParts: string[] = [];
  const wtPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = wtPattern.exec(xmlContent)) !== null) {
    if (m[1].trim()) textParts.push(m[1]);
  }

  // Also handle line breaks
  const result = textParts.join(" ").replace(/\s+/g, " ").trim();
  if (result.length < 20) {
    throw new Error("No readable text found in this DOCX file.");
  }
  return result;
}

/** Main entry point: extract text from any supported document */
export async function extractDocumentText(file: File): Promise<string> {
  const type = classifyFile(file);
  switch (type) {
    case "text":
      return extractText(file);
    case "pdf":
      return extractPDF(file);
    case "docx":
      return extractDOCX(file);
    default:
      throw new Error("Unsupported document type for text extraction.");
  }
}
