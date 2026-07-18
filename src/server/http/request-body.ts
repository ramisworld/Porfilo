import "server-only";

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidRequestBodyError extends Error {
  constructor(message = "Invalid request body.") {
    super(message);
    this.name = "InvalidRequestBodyError";
  }
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new InvalidRequestBodyError("Invalid content-length header.");
  }
  return length;
}

/** Read a request body while enforcing a byte limit before and during streaming. */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const length = declaredLength(request);
  if (length !== null && length > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body too large").catch(() => undefined);
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readLimitedText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await readLimitedBody(request, maxBytes),
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidRequestBodyError("Request body must be valid UTF-8.");
  }
}

export async function readLimitedJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const text = await readLimitedText(request, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidRequestBodyError("Invalid JSON body.");
  }
}
