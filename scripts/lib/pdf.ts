/**
 * PDF Generation via Shared PDF Worker
 * Uses the centralized pdf-worker service
 */

export interface PdfOptions {
  format?: "A4" | "Letter";
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
}

export interface PdfWorkerConfig {
  workerUrl: string;
  apiKey: string;
}

/**
 * Generate PDF from HTML using the shared PDF Worker
 */
export async function generatePdf(
  html: string,
  config: PdfWorkerConfig,
  options: PdfOptions = {}
): Promise<Uint8Array> {
  const response = await fetch(`${config.workerUrl}/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({ html, options }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDF Worker error: ${response.status} ${errorText}`);
  }

  const pdfBuffer = await response.arrayBuffer();
  console.log(`PDF generated: ${pdfBuffer.byteLength} bytes`);
  return new Uint8Array(pdfBuffer);
}

/**
 * Generate PNG screenshot from HTML using the shared PDF Worker
 */
export async function generateScreenshot(
  html: string,
  config: PdfWorkerConfig,
  options: { width?: number; height?: number; scale?: number } = {}
): Promise<Uint8Array> {
  const response = await fetch(`${config.workerUrl}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({ html, options }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDF Worker error: ${response.status} ${errorText}`);
  }

  const pngBuffer = await response.arrayBuffer();
  console.log(`Screenshot generated: ${pngBuffer.byteLength} bytes`);
  return new Uint8Array(pngBuffer);
}

/**
 * Load PDF Worker configuration from environment or .dev.vars
 */
export async function loadConfig(): Promise<PdfWorkerConfig | null> {
  // Try environment variables first
  let workerUrl = Deno.env.get("PDF_WORKER_URL");
  let apiKey = Deno.env.get("PDF_API_KEY");

  // If not in env, try loading from .dev.vars
  if (!workerUrl || !apiKey) {
    try {
      const devVars = await Deno.readTextFile(".dev.vars");
      for (const line of devVars.split("\n")) {
        const [key, ...valueParts] = line.split("=");
        const value = valueParts.join("=").trim();
        if (key === "PDF_WORKER_URL") workerUrl = value;
        if (key === "PDF_API_KEY") apiKey = value;
      }
    } catch {
      // .dev.vars not found, that's ok
    }
  }

  // Default worker URL
  if (!workerUrl) {
    workerUrl = "https://pdf.esolia.co.jp";
  }

  if (!apiKey) {
    console.error("Missing PDF_API_KEY");
    console.error("Set this in environment or .dev.vars file");
    return null;
  }

  return { workerUrl, apiKey };
}
