/**
 * Client-Side Text Extractor for Documents & Logs.
 * Runs in the user browser to offload all parsing overhead from low-memory servers.
 */

export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Read up to 4MB of the PDF buffer into string chunks
    let binary = "";
    const len = Math.min(uint8.length, 4 * 1024 * 1024);
    const chunkSize = 65536;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, Math.min(i + chunkSize, len)));
    }

    const textPieces = [];

    // Extract parenthesized text tokens: (text) Tj or (text) TJ
    const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|TJ|\x27|\x22)/g;
    let match;
    while ((match = tjRegex.exec(binary)) !== null) {
      let raw = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      const clean = raw.replace(/[^\x20-\x7E\n\r\t]/g, "").trim();
      if (clean.length > 1) {
        textPieces.push(clean);
      }
      if (textPieces.length > 1500) break;
    }

    // Fallback regex to scan readable text runs if specific PDF operators were not found
    if (textPieces.length < 5) {
      const asciiRegex = /[A-Za-z0-9\s.,;:!?_\-=/\\#@$%^&*()+[\]{}|~`\x27\x22]{8,}/g;
      let asciiMatch;
      let count = 0;
      while ((asciiMatch = asciiRegex.exec(binary)) !== null && count < 800) {
        const candidate = asciiMatch[0].trim();
        if (candidate.length > 8 && !candidate.startsWith("/Font") && !candidate.startsWith("/Type")) {
          textPieces.push(candidate);
          count++;
        }
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(" ");
    }
  } catch (err) {
    console.warn("[Client PDF Parser]", err);
  }

  return `[Extracted Bug Report: ${file.name} (Uploaded PDF Document - ${Math.round(file.size / 1024)} KB)]`;
}

export async function extractTextFromFile(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  
  if (ext === ".pdf") {
    return await extractTextFromPDF(file);
  }

  // Native text extraction for text, logs, json, xml, csv, md
  try {
    return await file.text();
  } catch (err) {
    return `[Attached Document: ${file.name}]`;
  }
}

