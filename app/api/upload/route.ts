export const runtime = "nodejs";

const UPLOAD_URL = "https://app.julia.healthcare/api/media/v1/resource";
const CDN_BASE = "https://d9sncwysbqqtc.cloudfront.net";

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;

  try {
    const form = await req.formData();

    file = form.get("file");
  } catch {
    return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
  }

  if (!file || typeof file === "string") {
    return Response.json({ error: "Falta el archivo" }, { status: 400 });
  }

  try {
    const fd = new FormData();

    fd.append("files", file);

    const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });

    if (!res.ok) {
      const text = await res.text();

      return Response.json(
        { error: `Upload failed: ${res.status}. ${text}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    if (!data.success || !data.key) {
      return Response.json(
        { error: data.message || "Upload failed" },
        { status: 502 },
      );
    }

    return Response.json({ url: `${CDN_BASE}/${data.key}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de subida";

    return Response.json({ error: message }, { status: 502 });
  }
}
