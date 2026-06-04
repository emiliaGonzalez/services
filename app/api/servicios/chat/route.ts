import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { TOOLS } from "@/lib/agent/tools";
import type { ChatRequestBody, StreamEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Model ID parametrizable. En Bedrock lleva prefijo `anthropic.`; si la cuenta exige
// un inference profile regional, usar p.ej. `us.anthropic.claude-sonnet-4-6`.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-sonnet-4-6";

// Credenciales y region via cadena estandar de AWS (AWS_REGION, AWS_ACCESS_KEY_ID, ...).
const client = new AnthropicBedrock();

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;

  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("`messages` is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(sse(event)));

      try {
        const messageStream = client.messages.stream({
          model: MODEL_ID,
          max_tokens: 4096,
          // Respuestas agiles para chat; subir a "medium" si se quiere mas razonamiento.
          output_config: { effort: "low" },
          // Prefijo estable (tools + system) cacheado entre turnos.
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: TOOLS,
          messages: body.messages,
        });

        messageStream.on("text", (delta) => {
          send({ type: "text_delta", text: delta });
        });

        const final = await messageStream.finalMessage();

        send({
          type: "message",
          content: final.content,
          stopReason: final.stop_reason,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error desconocido del modelo";

        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
