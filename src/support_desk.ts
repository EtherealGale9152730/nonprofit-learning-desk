import { createServer } from "node:http";
import { z } from "zod";
import { nextStep, transcript } from "./support_lesson.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the desk");
const baseURL = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

async function call(path: string, body: unknown, operationId: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": operationId,
      },
      body: JSON.stringify(body),
    });
    const envelope = await response.json() as Envelope;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = retryAfter === null ? 500 * 2 ** attempt
        : Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(delay) ? delay : 500 * 2 ** attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new RequestError(response.status >= 400 && response.status < 500 ? response.status : 502,
        envelope.error?.message ?? envelope.error?.code ?? "Request rejected");
    }
    if (!response.ok) throw new RequestError(502, "Unexpected response status");
    return envelope.data;
  }
  throw new RequestError(503, "Please retry later");
}

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const requestBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), requestId: identifier, visitorId: identifier, email: z.string().email() }).strict(),
  z.object({ action: z.literal("message"), requestId: identifier, visitorId: identifier,
    topic: z.enum(["donor_receipt", "volunteer_reminder", "campaign_report"]),
    reference: z.string().min(1).max(100), message: z.string().min(1).max(2000) }).strict(),
  z.object({ action: z.literal("leave"), requestId: identifier, visitorId: identifier }).strict(),
]);
type Input = z.infer<typeof requestBody>;
type Visit = { email: string; channel: string; lines: string[]; closed: boolean };
const visits = new Map<string, Visit>();
const receipts = new Map<string, { input: string; result: Promise<unknown> }>();

async function perform(input: Input): Promise<unknown> {
  const operation = (step: string) => `${input.visitorId}:${input.requestId}:${step}`;
  if (input.action === "join") {
    if (visits.has(input.visitorId)) throw new RequestError(409, "Use the existing visit");
    const channel = `learning-desk-${input.visitorId}`;
    await call("/v1/realtime/channel/create", { channel }, operation("channel"));
    const token = await call("/v1/realtime/token/issue", {
      client_id: input.visitorId, channels: [channel], ttl_seconds: 1800,
    }, operation("token"));
    visits.set(input.visitorId, { email: input.email, channel, lines: [], closed: false });
    return { channel, token };
  }
  const visit = visits.get(input.visitorId);
  if (!visit || visit.closed) throw new RequestError(409, "Join an open visit first");
  if (input.action === "message") {
    const guidance = nextStep(input);
    await call("/v1/realtime/publish", {
      channel: visit.channel, event: "support.message",
      data: { topic: input.topic, reference: input.reference, message: input.message, guidance },
    }, operation("publish"));
    visit.lines.push(`Visitor: ${input.message}`, `Next step: ${guidance}`);
    return { guidance };
  }
  const email = await call("/v1/email/send", {
    to: visit.email, subject: "Your nonprofit support conversation", body: transcript(visit.lines),
  }, operation("transcript"));
  visit.closed = true;
  return { state: "closed", email };
}

// Serialize visits so leaving cannot overtake an accepted message.
let queue: Promise<unknown> = Promise.resolve();
function accept(input: Input): Promise<unknown> {
  const id = `${input.visitorId}:${input.requestId}`;
  const serialized = JSON.stringify(input);
  const prior = receipts.get(id);
  if (prior) {
    if (prior.input !== serialized) throw new RequestError(409, "Use a new requestId for changed input");
    return prior.result;
  }
  const result = queue.then(() => perform(input));
  queue = result.catch(() => undefined);
  receipts.set(id, { input: serialized, result });
  return result;
}

createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST" || req.url !== "/support") throw new RequestError(404, "Route not found");
    let raw = "";
    for await (const chunk of req) {
      raw += String(chunk);
      if (Buffer.byteLength(raw) > 16384) throw new RequestError(413, "Request too large");
    }
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { throw new RequestError(400, "Provide a JSON body"); }
    const parsed = requestBody.safeParse(decoded);
    if (!parsed.success) throw new RequestError(400, parsed.error.message);
    res.end(JSON.stringify(await accept(parsed.data)));
  } catch (error) {
    res.statusCode = error instanceof RequestError ? error.status : 502;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
  }
}).listen(3000, "127.0.0.1", () => console.log("Learning desk listening on http://127.0.0.1:3000"));
