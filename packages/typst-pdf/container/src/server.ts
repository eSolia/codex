/**
 * Container HTTP Server — Hono on port 8080
 *
 * Runs inside Docker (node:22-slim + pandoc + typst).
 * Accepts markdown, produces branded eSolia PDFs via the Typst pipeline.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { execSync } from 'node:child_process';
import { generatePdf } from './pipeline.js';
import type { TypstPdfRequest } from './types.js';

const app = new Hono();

// Health check — report pandoc + typst versions
app.get('/health', (c) => {
  let pandocVersion = 'unknown';
  let typstVersion = 'unknown';
  try {
    pandocVersion = execSync('pandoc --version', { encoding: 'utf-8' }).split('\n')[0] ?? 'unknown';
    typstVersion = execSync('typst --version', { encoding: 'utf-8' }).trim();
  } catch {
    // Versions unavailable
  }
  return c.json({
    status: 'ok',
    version: '0.1.0',
    pandoc: pandocVersion,
    typst: typstVersion,
  });
});

// PDF generation endpoint
app.post('/pdf', async (c) => {
  const startTime = Date.now();

  let body: TypstPdfRequest;
  try {
    body = await c.req.json<TypstPdfRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate required fields
  if (!body.title || !body.sections || !Array.isArray(body.sections)) {
    return c.json({ error: 'Missing required fields: title, sections' }, 400);
  }

  if (!body.mode || !['single', 'bilingual'].includes(body.mode)) {
    return c.json({ error: 'Invalid mode: must be "single" or "bilingual"' }, 400);
  }

  try {
    const result = await generatePdf(body);
    const elapsed = Date.now() - startTime;
    console.log(`PDF generated in ${elapsed}ms (mode=${body.mode})`);
    return c.json(result);
  } catch (err) {
    console.error('PDF generation failed:', err);
    return c.json(
      { error: 'PDF generation failed', details: String(err) },
      500
    );
  }
});

const port = 8080;
console.log(`typst-pdf container listening on :${port}`);
serve({ fetch: app.fetch, port });
