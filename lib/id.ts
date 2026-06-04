import { nanoid } from "nanoid";

// Genera IDs con prefijo legible por tipo de entidad, p.ej. genId("serv") -> "serv_V1StGXR8_Z5j".
export function genId(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}
