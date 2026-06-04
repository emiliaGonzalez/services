// Protocolo cliente <-> server para el chat conversacional de alta de servicios.
//
// El historial vive en el cliente y se envia completo en cada request. El server
// (route handler) es un proxy stateless hacia Bedrock que reemite el stream.

import type {
  MessageParam,
  ContentBlock,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";

export type { MessageParam, ContentBlock, Tool };

/** Eventos SSE que el route handler emite hacia el cliente. */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "message"; content: ContentBlock[]; stopReason: string | null }
  | { type: "error"; message: string };

export interface ChatRequestBody {
  messages: MessageParam[];
}
