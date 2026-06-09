// Handoff cliente del PDF entre la opcion de "subir documento" y la pagina de
// procesado. Vive en estado de modulo: sobrevive la navegacion soft de App Router
// (router.push), y queda vacio tras un refresh duro (la pagina redirige de vuelta).

let pendingPdf: File | null = null;

export function setPendingPdf(file: File): void {
  pendingPdf = file;
}

export function takePendingPdf(): File | null {
  const f = pendingPdf;

  pendingPdf = null;

  return f;
}
