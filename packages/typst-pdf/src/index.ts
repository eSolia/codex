/**
 * typst-pdf Worker — Thin proxy to Cloudflare Container
 *
 * Routes requests to a Docker container running pandoc + typst.
 * The container handles markdown → pandoc → post-process → typst → PDF.
 *
 * Architecture:
 *   hanawa-cms → (service binding) → this Worker → (Durable Object) → Docker container
 *
 * InfoSec: Service binding is internal worker-to-worker (no auth needed)
 *
 * NOTE: Cloudflare Containers is a new feature. The Container base class is
 * provided by the runtime via `cloudflare:workers` but may not have TypeScript
 * declarations in @cloudflare/workers-types yet. We use `declare` to satisfy tsc.
 */
import { Hono } from 'hono';

// Cloudflare Containers base class — runtime-provided, types not yet in @cloudflare/workers-types
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
declare class Container {
  defaultPort: number;
  sleepAfter: number;
  onStart?(): void;
  onStop?(): void;
  onError?(error: unknown): Response;
  fetch(request: Request): Promise<Response>;
}

interface Env {
  TYPST_CONTAINER: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Forward a request to the container's Hono server.
 * Uses singleton pattern (idFromName("default")) to reuse the warm container.
 */
async function forwardToContainer(env: Env, request: Request, path: string): Promise<Response> {
  const id = env.TYPST_CONTAINER.idFromName('default');
  const stub = env.TYPST_CONTAINER.get(id);

  const containerUrl = new URL(path, 'http://container');
  const containerRequest = new Request(containerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  return stub.fetch(containerRequest);
}

// Health check — forwarded to container
app.get('/health', async (c) => {
  try {
    const response = await forwardToContainer(c.env, c.req.raw, '/health');
    return response;
  } catch (err) {
    return c.json(
      { status: 'error', version: '0.1.0', error: String(err) },
      503
    );
  }
});

// PDF generation — forwarded to container
app.post('/pdf', async (c) => {
  return forwardToContainer(c.env, c.req.raw, '/pdf');
});

/**
 * TypstPdfContainer — Durable Object wrapping the Docker container.
 *
 * The container runs node:22-slim with pandoc + typst installed.
 * A Hono HTTP server inside listens on port 8080.
 */
export class TypstPdfContainer extends Container {
  defaultPort = 8080;

  // Container sleeps after 5 minutes of inactivity
  sleepAfter = 300;

  onStart(): void {
    console.log('TypstPdfContainer started');
  }

  onStop(): void {
    console.log('TypstPdfContainer stopped');
  }

  onError(error: unknown): Response {
    console.error('TypstPdfContainer error:', error);
    return Response.json(
      { error: 'Container error', details: String(error) },
      { status: 500 }
    );
  }
}

export default app;
