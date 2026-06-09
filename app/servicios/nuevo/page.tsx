"use client";

import type { LucideIcon } from "lucide-react";
import type { MapLocation } from "@/components/chat/locations-map";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@heroui/react";
import {
  Palette,
  Utensils,
  Flower,
  PenTool,
  Building,
  Camera,
  Lightbulb,
  Gift,
  Armchair,
  Music,
  Users,
  Megaphone,
  Truck,
} from "lucide-react";

import { MessageBubble, TypingBubble } from "@/components/chat/message-bubble";
import { BottomSheet, NumberedOption } from "@/components/chat/bottom-sheet";
import { ChatInput } from "@/components/chat/chat-input";
import { PhotoUpload } from "@/components/chat/photo-upload";
import { PricingFlow } from "@/components/chat/pricing-flow";
import { setPendingPdf } from "@/lib/pending-import";
import { serviceCategories } from "@/config/site";
import { TOOL_NAMES, IMMEDIATE_TOOLS } from "@/lib/agent/tools";
import type { MessageParam, ContentBlock, StreamEvent } from "@/lib/agent/types";
import type { ServiceDraft } from "@/types/chat";

interface Bubble {
  id: string;
  role: "ai" | "user";
  content: string;
  typing?: boolean;
}

interface PendingTool {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const KICKOFF = "Hola, ayudame a dar de alta un servicio.";
const MAX_AUTO_ITERATIONS = 8;

// Tools interactivas que se muestran como modal sobre el input (el resto se responden
// directamente escribiendo en el input siempre visible).
// Tools cuya respuesta se puede dar escribiendo en el input (ademas de por su UI).
const TEXT_ANSWERABLE: ReadonlySet<string> = new Set([
  TOOL_NAMES.showOptions,
  TOOL_NAMES.showCategories,
]);

const STRUCTURED_TOOLS: ReadonlySet<string> = new Set([
  TOOL_NAMES.showOptions,
  TOOL_NAMES.showCategories,
  TOOL_NAMES.showLocationsMap,
  TOOL_NAMES.showPricing,
  TOOL_NAMES.showPhotoUpload,
]);

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  palette: Palette,
  utensils: Utensils,
  flower: Flower,
  "pen-tool": PenTool,
  building: Building,
  camera: Camera,
  lightbulb: Lightbulb,
  gift: Gift,
  armchair: Armchair,
  music: Music,
  users: Users,
  megaphone: Megaphone,
  truck: Truck,
};

const LocationsMap = dynamic(
  () => import("@/components/chat/locations-map"),
  { ssr: false },
);

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function optionIcon(name?: string) {
  // Solo se soporta paperclip (carga de archivo). Cualquier otro icono se ignora.
  if (name !== "paperclip") return undefined;

  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

async function* readSSE(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const parts = buf.split("\n\n");

    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));

      if (!line) continue;
      const json = line.slice(5).trim();

      if (json) yield JSON.parse(json) as StreamEvent;
    }
  }
}

export default function NuevoServicioPage() {
  const router = useRouter();
  const chatRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const messagesRef = useRef<MessageParam[]>([]);
  const pendingImmediateRef = useRef<ContentBlock[]>([]);
  const startedRef = useRef(false);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [gridOverride, setGridOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsFull, setOptionsFull] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(0);

  // Mide donde termina el header de la pagina para fijar ahi el sheet full-height.
  useEffect(() => {
    const update = () =>
      setHeaderBottom(headerRef.current?.getBoundingClientRect().bottom ?? 0);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  const [draft, setDraft] = useState<ServiceDraft>({
    name: "",
    category: "",
    description: "",
    locations: [],
    photos: [],
    pricingModel: "per_person",
    variableByHeadcount: false,
    basePrice: 0,
    priceRanges: [],
    optionGroups: [],
  });
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const addBubble = useCallback(
    (role: "ai" | "user", content: string, extra?: Partial<Bubble>) => {
      const id = uid();

      setBubbles((prev) => [...prev, { id, role, content, ...extra }]);

      return id;
    },
    [],
  );

  const updateBubble = useCallback((id: string, patch: Partial<Bubble>) => {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [bubbles, pendingTool, loading]);

  // Aplica una tool inmediata (no requiere interaccion del usuario).
  const executeImmediate = useCallback((block: ContentBlock) => {
    if (block.type !== "tool_use") return;
    const input = (block.input ?? {}) as Record<string, unknown>;

    if (block.name === TOOL_NAMES.updateDraft) {
      setDraft((d) => ({ ...d, ...(input as Partial<ServiceDraft>) }));
    }
  }, []);

  const toolResult = (id: string, content: string): ContentBlock =>
    ({ type: "tool_result", tool_use_id: id, content }) as unknown as ContentBlock;

  // Ejecuta un turno: envia el historial, consume el stream y procesa las tools.
  const runTurn = useCallback(
    async (working: MessageParam[], depth = 0) => {
      messagesRef.current = working;
      setLoading(true);
      setThinking(true);
      setError(null);
      setPendingTool(null);
      setGridOverride(false);
      setOptionsFull(false);

      let res: Response;

      try {
        res = await fetch("/api/servicios/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: working }),
        });
      } catch {
        setError("No se pudo conectar con el asistente.");
        setThinking(false);
        setLoading(false);

        return;
      }

      if (!res.ok || !res.body) {
        setError(`Error del asistente (${res.status}).`);
        setThinking(false);
        setLoading(false);

        return;
      }

      let bubbleId: string | null = null;
      let streamed = "";
      let finalContent: ContentBlock[] = [];

      for await (const ev of readSSE(res)) {
        if (ev.type === "text_delta") {
          streamed += ev.text;
          if (bubbleId === null) {
            setThinking(false);
            bubbleId = addBubble("ai", streamed);
          } else updateBubble(bubbleId, { content: streamed });
        } else if (ev.type === "message") {
          finalContent = ev.content;
        } else if (ev.type === "error") {
          setThinking(false);
          setError(ev.message);
          setLoading(false);

          return;
        }
      }

      setThinking(false);

      const assistantMsg: MessageParam = {
        role: "assistant",
        content: finalContent as MessageParam["content"],
      };

      working = [...working, assistantMsg];
      messagesRef.current = working;

      const toolUses = finalContent.filter((b) => b.type === "tool_use");

      // El asistente solo hablo: el input (siempre activo) recibe la respuesta libre.
      if (toolUses.length === 0) {
        pendingImmediateRef.current = [];
        setPendingTool(null);
        setLoading(false);

        return;
      }

      const immediateResults: ContentBlock[] = [];
      let interactive: ContentBlock | null = null;

      for (const tu of toolUses) {
        if (tu.type !== "tool_use") continue;
        if (tu.name === TOOL_NAMES.finishService) {
          setThinking(true);
          try {
            const res = await fetch("/api/servicios", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(draftRef.current),
            });

            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as {
                error?: string;
              } | null;

              setThinking(false);
              setError(data?.error ?? "No se pudo guardar el servicio.");
              setLoading(false);

              return;
            }
          } catch {
            setThinking(false);
            setError("No se pudo guardar el servicio.");
            setLoading(false);

            return;
          }

          const name = draftRef.current.name.trim();

          router.push(
            name
              ? `/servicios/exito?name=${encodeURIComponent(name)}`
              : "/servicios/exito",
          );

          return;
        }
        if (IMMEDIATE_TOOLS.has(tu.name)) {
          executeImmediate(tu);
          immediateResults.push(toolResult(tu.id, "ok"));
        } else {
          interactive = tu;
        }
      }

      if (interactive && interactive.type === "tool_use") {
        const input = (interactive.input ?? {}) as Record<string, unknown>;

        pendingImmediateRef.current = immediateResults;
        setPendingTool({ id: interactive.id, name: interactive.name, input });
        setLoading(false);

        return;
      }

      // Pregunta de texto libre: hay mensaje y NO se guardo nada (sin update_draft).
      // Espera la respuesta del usuario en el input.
      const hasUpdateDraft = toolUses.some(
        (t) => t.type === "tool_use" && t.name === TOOL_NAMES.updateDraft,
      );

      if (streamed.trim() && !hasUpdateDraft) {
        pendingImmediateRef.current = immediateResults;
        setPendingTool(null);
        setLoading(false);

        return;
      }

      // Solo tools inmediatas con datos guardados (update_draft) o sin texto:
      // continua el turno automaticamente para mostrar la siguiente UI (con tope).
      const userMsg: MessageParam = { role: "user", content: immediateResults };

      if (depth + 1 >= MAX_AUTO_ITERATIONS) {
        setError("El asistente se quedo en un bucle. Reintenta.");
        setLoading(false);

        return;
      }
      await runTurn([...working, userMsg], depth + 1);
    },
    [addBubble, updateBubble, executeImmediate, router],
  );

  // Resuelve la tool interactiva actual con la respuesta del usuario.
  const resolveTool = useCallback(
    (value: string, displayLabel?: string) => {
      const pending = pendingTool;

      if (!pending) return;
      if (displayLabel) addBubble("user", displayLabel);

      const results = [
        ...pendingImmediateRef.current,
        toolResult(pending.id, value),
      ];

      pendingImmediateRef.current = [];
      setPendingTool(null);
      setGridOverride(false);
      runTurn([
        ...messagesRef.current,
        { role: "user", content: results as MessageParam["content"] },
      ]);
    },
    [pendingTool, addBubble, runTurn],
  );

  // Texto del input (siempre activo). Si hay una tool que acepta texto, la responde;
  // si no hay tool, envia un mensaje libre. Devuelve false si no se envio.
  const handleUserText = useCallback(
    (text: string): boolean => {
      if (loading) return false;
      if (pendingTool) {
        // Solo tools que aceptan una respuesta de texto se resuelven escribiendo;
        // los wizards (precio, opciones, mapa, fotos) se responden por su UI.
        if (TEXT_ANSWERABLE.has(pendingTool.name)) {
          resolveTool(text, text);

          return true;
        }

        return false;
      }

      // Sin tool: mensaje libre. Incluye resultados de tools inmediatas pendientes
      // (si los hubiera) para no dejar tool_use sin tool_result.
      const pending = pendingImmediateRef.current;

      pendingImmediateRef.current = [];
      const content = pending.length
        ? ([...pending, { type: "text", text }] as MessageParam["content"])
        : text;

      addBubble("user", text);
      runTurn([...messagesRef.current, { role: "user", content }]);

      return true;
    },
    [loading, pendingTool, resolveTool, addBubble, runTurn],
  );

  // Arranca la conversacion una sola vez.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runTurn([{ role: "user", content: KICKOFF }]);
  }, [runTurn]);

  // Ruta "subir documento": flujo de UI (sin agente). Guarda el PDF y va a procesar.
  const handlePdf = useCallback(
    (file: File | undefined) => {
      if (!file || file.type !== "application/pdf") return;
      setPendingPdf(file);
      router.push("/servicios/importar");
    },
    [router],
  );

  // Renderiza solo las tools estructuradas (modal sobre el input). Las demas se
  // responden por el input siempre visible.
  const renderStructuredSheet = () => {
    if (!pendingTool || !STRUCTURED_TOOLS.has(pendingTool.name)) return null;

    const input = pendingTool.input;

    const categoryGrid = (
      <BottomSheet title="Selecciona una categoría">
        <div className="grid grid-cols-4 gap-2.5">
          {serviceCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon];

            return (
              <button
                key={cat.id}
                className="flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-lg border border-divider hover:bg-foreground-100 cursor-pointer transition-colors"
                type="button"
                onClick={() => resolveTool(cat.label, cat.label)}
              >
                {Icon && (
                  <Icon className="w-5 h-5 text-foreground-600" strokeWidth={1.75} />
                )}
                <span className="text-[11px] font-medium text-foreground text-center leading-tight px-1">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    );

    switch (pendingTool.name) {
      case TOOL_NAMES.showOptions: {
        const options =
          (input.options as {
            label: string;
            value: string;
            input?: boolean;
            highlighted?: boolean;
            icon?: "paperclip" | "download";
          }[]) ?? [];

        return (
          <BottomSheet title={(input.title as string) ?? "Elige una opción"}>
            <div className="flex flex-col">
              {options.map((opt, i) => {
                const isUpload = opt.input || opt.icon === "paperclip";

                if (isUpload) {
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-3.5 w-full px-3 py-3.5 rounded-[10px] border border-dashed border-[#C4C7CC] bg-[#EEF0F3] hover:bg-[#E6E8EC] cursor-pointer transition-colors"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handlePdf(e.dataTransfer.files[0]);
                      }}
                    >
                      <input
                        accept="application/pdf"
                        className="hidden"
                        type="file"
                        onChange={(e) => handlePdf(e.target.files?.[0])}
                      />
                      <span className="shrink-0 w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[13px] font-semibold">
                        {i + 1}
                      </span>
                      <span className="flex items-center gap-2 text-[15px] text-[#1A1A1A]">
                        <span className="shrink-0 text-[#6B7280]">
                          {optionIcon("paperclip")}
                        </span>
                        {opt.label}
                      </span>
                    </label>
                  );
                }

                return (
                  <NumberedOption
                    key={opt.value}
                    highlighted={opt.highlighted}
                    icon={optionIcon(opt.icon)}
                    label={opt.label}
                    number={i + 1}
                    onClick={() => resolveTool(opt.value, opt.label)}
                  />
                );
              })}
            </div>
          </BottomSheet>
        );
      }

      case TOOL_NAMES.showCategories: {
        // El cliente agrega "Otra" y abre la grilla localmente (sin pasar por el modelo).
        if (gridOverride) return categoryGrid;

        const suggestions = (input.suggestions as string[]) ?? [];

        return (
          <BottomSheet title="¿Cuál es la categoría del servicio?">
            <div className="flex flex-col">
              {suggestions.map((label, i) => (
                <NumberedOption
                  key={label}
                  label={label}
                  number={i + 1}
                  onClick={() => resolveTool(label, label)}
                />
              ))}
              <NumberedOption
                label="Otra"
                number={suggestions.length + 1}
                onClick={() => setGridOverride(true)}
              />
            </div>
          </BottomSheet>
        );
      }

      case TOOL_NAMES.showLocationsMap: {
        const locations = (input.locations as MapLocation[]) ?? [];

        return (
          <BottomSheet title="¿Las ubicaciones son correctas?">
            <LocationsMap
              key={locations.map((l) => l.query).join("|")}
              locations={locations}
            />
            <div className="flex flex-col">
              <NumberedOption
                label="Sí, son correctas"
                number={1}
                onClick={() => resolveTool("confirmadas", "Sí, son correctas")}
              />
              <NumberedOption
                label="No, quiero corregirlas"
                number={2}
                onClick={() => resolveTool("corregir", "No, quiero corregirlas")}
              />
            </div>
          </BottomSheet>
        );
      }

      case TOOL_NAMES.showPhotoUpload:
        return (
          <BottomSheet title="Fotos del servicio">
            <PhotoUpload
              min={(input.min as number) ?? 3}
              onDone={(urls) => {
                setDraft((d) => ({ ...d, photos: urls }));
                resolveTool(
                  JSON.stringify(urls),
                  `${urls.length} foto(s) subida(s)`,
                );
              }}
            />
          </BottomSheet>
        );

      case TOOL_NAMES.showPricing:
        return (
          <PricingFlow
            onEnterOptions={() => setOptionsFull(true)}
            onDone={(pricing, options) => {
              setDraft((d) => ({
                ...d,
                pricingModel: pricing.pricingModel,
                variableByHeadcount: pricing.variableByHeadcount,
                basePrice: pricing.basePrice,
                priceRanges: pricing.priceRanges,
                optionGroups: options.groups.map((g) => ({
                  id: g.id,
                  name: g.name,
                  pricingMode: g.pricingMode,
                  dependsOn: g.dependsOnId,
                  options: g.options.map((o) => ({
                    name: o.name,
                    prices: Object.fromEntries(
                      o.prices.map((p, i) => [String(i), p]),
                    ),
                  })),
                })),
              }));
              resolveTool(
                JSON.stringify({
                  pricingModel: pricing.pricingModel,
                  variableByHeadcount: pricing.variableByHeadcount,
                  basePrice: pricing.basePrice,
                  priceRanges: pricing.priceRanges,
                  optionGroups: options.groups,
                }),
                `${pricing.summary} · Opciones: ${options.summary}`,
              );
            }}
          />
        );

      default:
        return null;
    }
  };

  const structuredSheet = renderStructuredSheet();

  return (
    <div className="flex flex-col h-full bg-foreground-50">
      <div
        ref={headerRef}
        className="flex items-center justify-between h-14 px-8 shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <button
            className="text-foreground-500 hover:text-foreground"
            type="button"
            onClick={() => router.push("/servicios")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-foreground">
            Crear nuevo servicio
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div ref={chatRef} className="flex-1 overflow-y-auto px-40 pt-5 pb-8">
          <div className="flex flex-col gap-4">
            {bubbles.map((msg) => (
              <MessageBubble key={msg.id} content={msg.content} role={msg.role} />
            ))}
            {thinking && <TypingBubble />}
          </div>
        </div>

        {/* Footer: input siempre visible (el sheet va fixed abajo) */}
        <div className="shrink-0">
          {!loading && error && (
            <div className="w-full px-40 pt-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                <span className="text-sm text-danger-600">{error}</span>
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => runTurn(messagesRef.current)}
                >
                  Reintentar
                </Button>
              </div>
            </div>
          )}

          <ChatInput onSend={handleUserText} />
        </div>
      </div>

      {/* Sheet: normal pegado al fondo, o full-height desde el header (grupos de opciones) */}
      {!loading && !error && structuredSheet && (
        <div
          key={pendingTool?.id}
          className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up"
          style={optionsFull ? { top: headerBottom } : undefined}
        >
          {structuredSheet}
        </div>
      )}
    </div>
  );
}
