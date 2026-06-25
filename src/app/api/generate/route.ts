import { type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "~/server/ratelimit";
import { runGeneration } from "~/server/portfolio/generate";

// Prisma / Octokit / Anthropic are Node-only — do NOT run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i, "Invalid GitHub username"),
  vibe: z.string().trim().min(1, "Describe a vibe").max(300),
});

function json(data: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sseFrame(ev: unknown): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request";
    return json({ error: msg ?? "Invalid request" }, 400);
  }
  const { username, vibe } = parsed;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`${ip}:${username.toLowerCase()}`);
  if (!rl.ok) {
    return json({ error: "Too many requests. Slow down." }, 429, {
      "retry-after": String(rl.retryAfter),
    });
  }

  // -----------------------------------------------------------------------
  // Why TransformStream instead of `new ReadableStream({ start })`:
  //
  // `ReadableStream`'s consumer (Next.js, when adapting the Web Response to
  // a Node response) does not pull chunks from the controller's queue until
  // `start()` *resolves*. If `start()` is `async` and contains the whole
  // generator loop, NOTHING is sent over the wire until generation finishes
  // — every event gets buffered into the internal queue and flushed at the
  // very end. That's exactly the "all stages dim, then suddenly redirect"
  // bug we were seeing.
  //
  // A TransformStream sidesteps this: we hand Next.js the readable side
  // immediately, and a separate background async function writes into the
  // writable side as work progresses. Chunks are observable on the wire as
  // soon as `writer.write()` returns, regardless of how long the overall
  // job takes.
  // -----------------------------------------------------------------------
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  let closed = false;
  const safeWrite = async (chunk: Uint8Array) => {
    if (closed) return;
    try {
      await writer.write(chunk);
    } catch {
      closed = true;
    }
  };
  const safeClose = async () => {
    if (closed) return;
    closed = true;
    try {
      await writer.close();
    } catch {
      // already closed
    }
  };

  // Heartbeat every 8 s. Doubles as a stream-alive signal for clients behind
  // any intermediary that closes idle connections.
  const heartbeat = setInterval(() => {
    void safeWrite(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
  }, 8000);

  // Stop work + flush close when the client disconnects.
  req.signal.addEventListener(
    "abort",
    () => {
      clearInterval(heartbeat);
      void safeClose();
    },
    { once: true },
  );

  // Kick off the generation in the background. Crucially, this runs BEFORE
  // we return the Response — so by the time Next.js receives the response
  // body, there are already bytes in the pipe.
  void (async () => {
    try {
      // 2 KB of SSE-comment padding to bust any byte-threshold buffer that
      // still exists between us and the browser (Vercel edge, dev proxies,
      // some Chrome internal buffering on small first chunks). Comment lines
      // beginning with ":" are ignored by SSE clients.
      await safeWrite(encoder.encode(":" + " ".repeat(2048) + "\n\n"));

      // Immediate synthetic "open" event — the client transitions out of
      // its "connecting" state on this, before any backend work runs.
      await safeWrite(encoder.encode(sseFrame({ stage: "open" })));

      for await (const event of runGeneration(username, vibe)) {
        if (closed) break;
        await safeWrite(encoder.encode(sseFrame(event)));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Generation failed.";
      await safeWrite(encoder.encode(sseFrame({ stage: "error", error })));
    } finally {
      clearInterval(heartbeat);
      await safeClose();
    }
  })();

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      // Hint to nginx / Vercel edge / dev proxies to NOT buffer this stream.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
