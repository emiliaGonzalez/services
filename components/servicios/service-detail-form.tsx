"use client";

import type { ServiceDraft, OptionGroup, PriceRange } from "@/types/chat";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus, Pencil, Trash2, X, MapPin, Link2 } from "lucide-react";

import { EditGroupModal } from "./edit-group-modal";
import { Toggle } from "./toggle";

const LocationsMap = dynamic(
  () => import("@/components/chat/locations-map"),
  { ssr: false },
);

const uid = () => `optn_${Math.random().toString(36).slice(2, 10)}`;

interface Category {
  id: string;
  name: string;
}

interface Props {
  serviceId: string;
  initial: ServiceDraft;
  categories: Category[];
}

const money = (n: number) => `€${n.toLocaleString("es-MX")}`;

// Mantiene los rangos contiguos: ordena por limite superior (abierto = ultimo),
// deriva from_0 = 1 y from_i = to_(i-1) + 1, y deja el ultimo abierto (to = 0 ->
// "En adelante"). Limpia data incongruente al cargar y tras cada edicion.
function normalizeRanges(ranges: PriceRange[]): PriceRange[] {
  const upper = (r: PriceRange) => (r.to === 0 ? Infinity : r.to);
  const out = ranges.map((r) => ({ ...r })).sort((a, b) => upper(a) - upper(b));

  for (let i = 0; i < out.length; i++) {
    out[i].from = i === 0 ? 1 : out[i - 1].to + 1;
    if (i === out.length - 1) {
      out[i].to = 0; // ultimo: abierto
    } else if (out[i].to <= out[i].from) {
      out[i].to = out[i].from + 1;
    }
  }

  return out;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-foreground-500">
      {children}
    </span>
  );
}

export function ServiceDetailForm({ serviceId, initial, categories }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<ServiceDraft>(() => ({
    ...initial,
    priceRanges: normalizeRanges(initial.priceRanges),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [locInput, setLocInput] = useState("");
  const [editing, setEditing] = useState<{ index: number } | "new" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<ServiceDraft>) => setDraft((d) => ({ ...d, ...p }));

  const mapLocations = useMemo(
    () =>
      draft.locations.map((label) => ({
        label,
        query: label,
        type: "zone" as const,
      })),
    [draft.locations],
  );

  const catOptions = useMemo(() => {
    const names = categories.map((c) => c.name);

    if (draft.category && !names.includes(draft.category)) {
      return [draft.category, ...names];
    }

    return names;
  }, [categories, draft.category]);

  // --- Fotos ---
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));

    setUploading((n) => n + imgs.length);
    for (const file of imgs) {
      try {
        const fd = new FormData();

        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();

        if (res.ok && data.url) {
          setDraft((d) => ({ ...d, photos: [...d.photos, data.url] }));
        }
      } catch {
        /* ignora el archivo fallido */
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removePhoto = (i: number) =>
    setDraft((d) => ({ ...d, photos: d.photos.filter((_, idx) => idx !== i) }));

  // --- Ubicaciones ---
  const addLocation = () => {
    const v = locInput.trim();

    if (!v || draft.locations.includes(v)) return;
    patch({ locations: [...draft.locations, v] });
    setLocInput("");
  };
  const removeLocation = (i: number) =>
    patch({ locations: draft.locations.filter((_, idx) => idx !== i) });

  // --- Rangos de precio (siempre contiguos: el `from` se deriva del `to` anterior) ---
  const setRangePrice = (i: number, price: number) =>
    patch({
      priceRanges: draft.priceRanges.map((r, idx) =>
        idx === i ? { ...r, price } : r,
      ),
    });

  // Confirma (onBlur) el tope de un rango = mueve SOLO la frontera compartida con
  // el rango siguiente (su `from` baja/sube con el `to`), topada por las fronteras
  // vecinas. No empuja ni recalcula los demas rangos.
  const setRangeTo = (i: number, newTo: number) =>
    setDraft((d) => {
      const rs = d.priceRanges.map((r) => ({ ...r }));

      if (i < 0 || i >= rs.length - 1) return d; // el ultimo no tiene tope editable
      const minTo = rs[i].from; // el rango i conserva al menos 1 persona
      const nextIsLast = i + 1 === rs.length - 1;
      const maxTo = nextIsLast ? Infinity : rs[i + 1].to - 1; // el i+1 conserva >= 1
      const v = Math.min(Math.max(newTo || minTo, minTo), maxTo);

      rs[i].to = v;
      rs[i + 1].from = v + 1;

      return { ...d, priceRanges: rs };
    });

  // Editar el inicio de un rango (i > 0) = mover esa misma frontera (el tope de i-1).
  const setRangeFrom = (i: number, newFrom: number) => {
    if (i <= 0) return;
    setRangeTo(i - 1, newFrom - 1);
  };

  const addRange = () =>
    setDraft((d) => {
      const rs = d.priceRanges.map((r) => ({ ...r }));

      if (!rs.length) {
        return { ...d, priceRanges: [{ from: 1, to: 0, price: d.basePrice }] };
      }
      // El ultimo rango (abierto) pasa a estar acotado y se agrega uno nuevo abierto.
      const last = rs[rs.length - 1];

      last.to = last.from + 49;
      rs.push({ from: last.to + 1, to: 0, price: last.price });

      return { ...d, priceRanges: normalizeRanges(rs) };
    });

  const removeRange = (i: number) =>
    setDraft((d) => ({
      ...d,
      priceRanges: normalizeRanges(d.priceRanges.filter((_, idx) => idx !== i)),
    }));

  // --- Grupos de opciones ---
  const groupById = (id: string) =>
    draft.optionGroups.find((g) => g.id === id);

  const optionValue = (group: OptionGroup, optIndex: number) => {
    const v = group.options[optIndex]?.prices["0"] ?? 0;
    const label =
      v === 0
        ? "Incluido"
        : `+${money(v)}${group.pricingMode === "per_pax" ? "/persona" : ""}`;

    return { v, label };
  };

  const unitSuffix =
    draft.pricingModel === "per_person"
      ? "/persona"
      : draft.pricingModel === "per_unit"
        ? "/u"
        : "";

  const saveGroup = (group: OptionGroup) => {
    setDraft((d) => {
      if (editing === "new") {
        return { ...d, optionGroups: [...d.optionGroups, group] };
      }
      if (editing && typeof editing === "object") {
        return {
          ...d,
          optionGroups: d.optionGroups.map((g, idx) =>
            idx === editing.index ? group : g,
          ),
        };
      }

      return d;
    });
    setEditing(null);
  };

  const removeGroup = (i: number) =>
    setDraft((d) => {
      const target = d.optionGroups[i];

      return {
        ...d,
        // quita el grupo y limpia dependencias que lo apuntaban
        optionGroups: d.optionGroups
          .filter((_, idx) => idx !== i)
          .map((g) =>
            g.dependsOn === target.id ? { ...g, dependsOn: null } : g,
          ),
      };
    });

  // --- Guardar ---
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/servicios/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(data?.error ?? "No se pudo guardar.");
        setSaving(false);

        return;
      }
      router.push("/servicios");
      router.refresh();
    } catch {
      setError("No se pudo guardar.");
      setSaving(false);
    }
  };

  const inputCls =
    "h-12 w-full rounded-[10px] border border-divider bg-background px-4 text-[15px] text-foreground outline-none focus:border-foreground-400";

  return (
    <div className="min-h-full bg-foreground-50 pb-[70px]">
      <div className="mx-auto max-w-[1200px] px-10 py-8">
        <div className="flex gap-8">
          {/* ---------- Columna izquierda ---------- */}
          <div className="flex flex-1 flex-col gap-7">
            {/* Fotos */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <FieldLabel>Fotos del servicio</FieldLabel>
                <span className="text-xs text-foreground-500">
                  {draft.photos.length} foto{draft.photos.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex gap-2.5">
                {draft.photos.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="group relative h-[120px] min-w-0 flex-1 overflow-hidden rounded-[10px] bg-foreground-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={url}
                    />
                    <button
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      type="button"
                      onClick={() => removePhoto(i)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="flex h-[120px] w-[100px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-divider text-foreground-500 transition-colors hover:bg-foreground-100"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus size={20} />
                  <span className="text-[11px]">
                    {uploading > 0 ? `Subiendo…` : "Agregar"}
                  </span>
                </button>
              </div>
              <input
                ref={fileRef}
                multiple
                accept="image/*"
                className="hidden"
                type="file"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </section>

            {/* Nombre */}
            <section className="flex flex-col gap-2">
              <FieldLabel>Nombre del servicio</FieldLabel>
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </section>

            {/* Categoría */}
            <section className="flex flex-col gap-1.5">
              <FieldLabel>Categoría</FieldLabel>
              <select
                className="h-11 w-full rounded-[10px] border border-divider bg-background px-3.5 text-[15px] text-foreground outline-none focus:border-foreground-400"
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value })}
              >
                {catOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </section>

            {/* Descripción */}
            <section className="flex flex-col gap-1.5">
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                className="min-h-[100px] w-full rounded-[10px] border border-divider bg-background p-3.5 text-[14px] leading-relaxed text-foreground outline-none focus:border-foreground-400"
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </section>

            {/* Ubicaciones */}
            <section className="flex flex-col gap-2.5">
              <FieldLabel>Ubicaciones</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {draft.locations.map((loc, i) => (
                  <span
                    key={`${loc}-${i}`}
                    className="flex items-center gap-1.5 rounded-full border border-divider bg-background py-1.5 pl-3.5 pr-2 text-sm text-foreground"
                  >
                    {loc}
                    <button
                      className="text-foreground-400 hover:text-foreground"
                      type="button"
                      onClick={() => removeLocation(i)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <input
                  className="rounded-full border border-divider bg-background px-3.5 py-1.5 text-sm text-foreground outline-none placeholder:text-foreground-400 focus:border-foreground-400"
                  placeholder="+ Agregar ubicación"
                  value={locInput}
                  onChange={(e) => setLocInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                />
              </div>
              {draft.locations.length > 0 ? (
                <LocationsMap
                  key={draft.locations.join("|")}
                  locations={mapLocations}
                />
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-xl bg-foreground-100 text-foreground-400">
                  <MapPin size={26} />
                  <span className="text-sm">Sin ubicaciones</span>
                </div>
              )}
            </section>
          </div>

          {/* ---------- Columna derecha ---------- */}
          <div className="flex w-[420px] shrink-0 flex-col gap-6">
            {/* Pricing */}
            <div className="flex flex-col gap-5 rounded-2xl border border-divider bg-background p-6">
              <h2 className="text-base font-bold text-foreground">Pricing</h2>

              <div className="flex flex-col gap-2.5">
                <FieldLabel>Modelo de cobro</FieldLabel>
                <div className="flex gap-2">
                  {(
                    [
                      ["fixed", "Fijo"],
                      ["per_person", "Por persona"],
                      ["per_unit", "Unidades"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] transition-colors ${
                        draft.pricingModel === value
                          ? "bg-foreground font-medium text-background"
                          : "border border-divider text-foreground hover:bg-foreground-50"
                      }`}
                      type="button"
                      onClick={() => patch({ pricingModel: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5">
                <Toggle
                  on={draft.variableByHeadcount}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      variableByHeadcount: v,
                      priceRanges:
                        v && d.priceRanges.length === 0
                          ? [{ from: 1, to: 0, price: d.basePrice }]
                          : d.priceRanges,
                    }))
                  }
                />
                <span className="text-[13px] text-foreground">
                  Varía por rango de personas
                </span>
              </label>

              {draft.variableByHeadcount ? (
                <div className="flex flex-col gap-2.5">
                  <FieldLabel>Rangos de precio</FieldLabel>
                  {draft.priceRanges.map((r, i) => {
                    const isLast = i === draft.priceRanges.length - 1;

                    return (
                      <div
                        key={i}
                        className="group flex items-center justify-between rounded-[10px] bg-[#E8EAED] px-3.5 py-3"
                      >
                        <div className="flex items-center gap-2 text-[13px] text-foreground">
                          <div className="flex w-[150px] items-center gap-1">
                            {i === 0 ? (
                              <span className="tabular-nums">{r.from}</span>
                            ) : (
                              <EditableNum
                                value={r.from}
                                onCommit={(v) => setRangeFrom(i, v)}
                              />
                            )}
                            <span className="text-foreground-400">–</span>
                            {isLast ? (
                              <span className="text-foreground-500">
                                En adelante
                              </span>
                            ) : (
                              <EditableNum
                                value={r.to}
                                onCommit={(v) => setRangeTo(i, v)}
                              />
                            )}
                          </div>
                          <span className="text-foreground-500">personas</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center text-[14px] font-semibold text-foreground">
                            <span>€</span>
                            <EditableNum
                              align="right"
                              value={r.price}
                              onCommit={(v) => setRangePrice(i, v)}
                            />
                            <span className="text-foreground-500">
                              {unitSuffix}
                            </span>
                          </div>
                          <button
                            className="text-foreground-400 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                            type="button"
                            onClick={() => removeRange(i)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <AddRow label="Agregar rango" onClick={addRange} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <FieldLabel>Precio</FieldLabel>
                  <div className="flex items-center justify-between rounded-[10px] bg-[#E8EAED] px-3.5 py-3">
                    <span className="text-[13px] text-foreground-500">
                      Precio{" "}
                      {draft.pricingModel === "per_person"
                        ? "por persona"
                        : draft.pricingModel === "per_unit"
                          ? "por unidad"
                          : "fijo"}
                    </span>
                    <div className="flex items-center text-[14px] font-semibold text-foreground">
                      <span>€</span>
                      <EditableNum
                        align="right"
                        value={draft.basePrice}
                        onCommit={(v) => patch({ basePrice: v })}
                      />
                      <span className="text-foreground-500">{unitSuffix}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Opciones adicionales */}
            <div className="flex flex-col gap-5 rounded-2xl border border-divider bg-background p-6">
              <h2 className="text-base font-bold text-foreground">
                Opciones adicionales
              </h2>

              {draft.optionGroups.map((g, i) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-2.5 border-t border-divider pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {g.name || "Grupo sin nombre"}
                      </span>
                      {g.dependsOn && (
                        <span className="flex items-center gap-1 self-start rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#D97706]">
                          <Link2 size={9} />
                          Depende de: {groupById(g.dependsOn)?.name ?? "otro grupo"}
                        </span>
                      )}
                    </div>
                    <button
                      className="mt-0.5 text-foreground-400 hover:text-foreground"
                      type="button"
                      onClick={() => setEditing({ index: i })}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                  {g.options.map((o, oi) => {
                    const { v, label } = optionValue(g, oi);

                    return (
                      <div
                        key={oi}
                        className="flex items-center justify-between rounded-lg bg-[#E8EAED] px-3 py-2.5"
                      >
                        <span className="text-[13px] text-foreground">
                          {o.name || "Opción"}
                        </span>
                        <span
                          className={`text-[13px] font-medium ${
                            v === 0 ? "text-foreground-500" : "text-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              <AddRow
                label="Agregar grupo de opciones"
                onClick={() => setEditing("new")}
              />
            </div>

            {error && (
              <span className="text-sm text-danger">{error}</span>
            )}
          </div>
        </div>
      </div>

      {/* Floating bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex h-[70px] items-center justify-between border-t border-divider/50 bg-background/80 px-10 backdrop-blur-xl">
        <span className="text-sm text-foreground-500">
          Los cambios se guardan como borrador automáticamente
        </span>
        <div className="flex items-center gap-3">
          <button
            className="h-10 rounded-[10px] border border-divider px-6 text-sm text-foreground-500 transition-colors hover:bg-foreground-50"
            type="button"
            onClick={() => router.push("/servicios")}
          >
            Cancelar
          </button>
          <button
            className="h-10 rounded-[10px] bg-foreground px-7 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={saving}
            type="button"
            onClick={save}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {editing !== null && (
        <EditGroupModal
          allGroups={draft.optionGroups}
          group={
            editing === "new"
              ? {
                  id: uid().replace("optn_", "grou_"),
                  name: "",
                  pricingMode: "fixed",
                  dependsOn: null,
                  options: [{ name: "", prices: { "0": 0 } }],
                }
              : draft.optionGroups[editing.index]
          }
          isNew={editing === "new"}
          onCancel={() => setEditing(null)}
          onDelete={
            editing !== "new"
              ? () => {
                  removeGroup(editing.index);
                  setEditing(null);
                }
              : undefined
          }
          onSave={saveGroup}
        />
      )}
    </div>
  );
}

// Input numerico que se lee como texto (hereda tipografia de la fila). Mantiene
// estado local mientras se escribe (se puede borrar/reescribir libremente) y solo
// confirma en onBlur / Enter, evitando que la validacion pelee con el usuario.
function EditableNum({
  value,
  onCommit,
  align = "left",
}: {
  value: number;
  onCommit: (v: number) => void;
  align?: "left" | "right";
}) {
  const [text, setText] = useState(String(value));

  // Resincroniza si el valor cambia desde afuera (p.ej. al empujar rangos).
  useEffect(() => setText(String(value)), [value]);

  const chars = Math.max(text.length, 1);
  const commit = () => onCommit(Number(text.replace(/[^0-9]/g, "")) || 0);

  return (
    <input
      className={`rounded bg-transparent px-1 text-inherit outline-none transition-colors hover:bg-black/[0.05] focus:bg-white focus:ring-1 focus:ring-foreground-300 ${
        align === "right" ? "text-right" : "text-center"
      }`}
      inputMode="numeric"
      style={{ width: `calc(${chars}ch + 0.75rem)` }}
      type="text"
      value={text}
      onBlur={commit}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-1.5 text-[13px] text-foreground-500 transition-colors hover:text-foreground"
      type="button"
      onClick={onClick}
    >
      <Plus size={14} />
      {label}
    </button>
  );
}
