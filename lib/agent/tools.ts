// Definiciones de las tools del agente. Fuente de verdad de nombres e inputs,
// compartida entre el route handler (las manda a Bedrock) y el cliente (las ejecuta).
//
// Dos clases de tool:
//  - INMEDIATAS: el cliente las aplica al estado y continua el turno solo.
//  - INTERACTIVAS: el cliente renderiza UI y espera; la accion del usuario es el tool_result.

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const TOOL_NAMES = {
  updateDraft: "update_service_draft",
  showOptions: "show_options",
  showCategories: "show_categories",
  showLocationsMap: "show_locations_map",
  showPricing: "show_pricing",
  showPhotoUpload: "show_photo_upload",
  finishService: "finish_service",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/** Tools que el cliente ejecuta sin esperar al usuario (continua el turno automaticamente). */
export const IMMEDIATE_TOOLS: ReadonlySet<string> = new Set([
  TOOL_NAMES.updateDraft,
]);

export const TOOLS: Tool[] = [
  {
    name: TOOL_NAMES.updateDraft,
    description:
      "Guarda o actualiza datos del servicio que se esta dando de alta. Llama a esta tool en cuanto el usuario te confirme un dato (nombre, categoria, ubicaciones, modelo de precio, rangos, etc.), ANTES de avanzar al siguiente paso. Solo incluye los campos que cambian.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del servicio." },
        category: { type: "string", description: "Categoria del servicio." },
        description: { type: "string", description: "Descripcion breve." },
        locations: {
          type: "array",
          items: { type: "string" },
          description: "Ciudades, comunidades o barrios donde se ofrece.",
        },
        pricingModel: {
          type: "string",
          enum: ["fixed", "per_person", "per_unit"],
          description:
            "Modelo de cobro: precio fijo por evento, por persona (pax), o por unidad.",
        },
        variableByHeadcount: {
          type: "boolean",
          description: "Si el precio por pax varia segun el numero de asistentes.",
        },
        basePrice: { type: "number", description: "Precio base si aplica." },
        priceRanges: {
          type: "array",
          description: "Rangos de precio por persona.",
          items: {
            type: "object",
            properties: {
              from: { type: "number" },
              to: { type: "number" },
              price: { type: "number" },
            },
            required: ["from", "to", "price"],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.showOptions,
    description:
      "Muestra una lista de opciones numeradas para que el usuario elija una. Usala cuando la respuesta sea una eleccion entre alternativas claras (si/no, modelo de precio, etc.). El resultado sera el 'value' de la opcion elegida.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo del panel de opciones." },
        options: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Texto visible de la opcion." },
              value: {
                type: "string",
                description: "Valor que recibiras como resultado al elegirla.",
              },
              input: {
                type: "boolean",
                description:
                  "true = la opcion es una zona de carga de archivo real (abre el selector de archivos al hacer clic). Usalo para 'subir/arrastrar un documento'.",
              },
              highlighted: {
                type: "boolean",
                description:
                  "Resalta la opcion con fondo gris. Las opciones tipo input/carga deben ir highlighted.",
              },
              icon: {
                type: "string",
                enum: ["paperclip"],
                description:
                  "Icono antes del texto. Solo 'paperclip' para opciones de subir/arrastrar archivos. Las demas opciones no llevan icono.",
              },
            },
            required: ["label", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "options"],
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.showCategories,
    description:
      "Muestra el paso de categoria: una lista de 2-3 categorias sugeridas. El cliente agrega automaticamente una opcion 'Otra' que abre la grilla completa, asi que NO la incluyas tu. El resultado sera la categoria elegida.",
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string" },
          description:
            "2-3 categorias probables (etiquetas) segun el nombre del servicio.",
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.showLocationsMap,
    description:
      "Muestra un mapa con las ubicaciones del servicio (zonas como poligonos, puntos como marcadores) y pregunta al usuario si son correctas. Usala justo despues de que el usuario ingrese sus ubicaciones. El resultado sera 'confirmadas' o 'corregir'.",
    input_schema: {
      type: "object",
      properties: {
        locations: {
          type: "array",
          minItems: 1,
          description: "Ubicaciones a mostrar en el mapa.",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Nombre corto para mostrar (ej. 'Polanco').",
              },
              query: {
                type: "string",
                description:
                  "Consulta geografica PRECISA y DESAMBIGUADA para geocodificar, incluyendo ciudad, estado y pais segun el contexto (ej. 'Polanco, Miguel Hidalgo, Ciudad de Mexico, Mexico'). Es CRITICO para ubicar bien: nunca pases solo el nombre suelto.",
              },
              type: {
                type: "string",
                enum: ["zone", "point"],
                description:
                  "'zone' para areas (colonias, ciudades, municipios, regiones) -> se dibuja el poligono real. 'point' para una direccion o lugar especifico -> se dibuja un marcador.",
              },
            },
            required: ["label", "query", "type"],
            additionalProperties: false,
          },
        },
      },
      required: ["locations"],
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.showPricing,
    description:
      "Inicia el paso de precio Y grupos de opciones. El CLIENTE conduce TODO en UI encadenada sin que tu intervengas: tipo de cobro -> ¿varia por numero de personas? -> monto o rangos -> creacion/edicion de grupos de opciones y sus opciones. Llamala UNA sola vez (cubre los pasos 5 y 6); no preguntes precios por texto ni con show_options, y no hay una tool aparte para grupos. El resultado sera un resumen del precio y las opciones configuradas; despues solo queda finish_service.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: TOOL_NAMES.showPhotoUpload,
    description:
      "Muestra el control para subir fotos del servicio. Usala en la etapa de fotos. El resultado indicara que el usuario continuo (subida simulada en esta demo).",
    input_schema: {
      type: "object",
      properties: {
        min: { type: "integer", description: "Minimo de fotos sugerido (opcional)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.finishService,
    description:
      "Finaliza el alta del servicio y lleva al usuario a la pantalla de exito. Llama a esta tool solo cuando ya recolectaste todos los datos necesarios y el usuario confirmo que termino.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];
