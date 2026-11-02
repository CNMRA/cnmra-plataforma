// Utilidades compartidas del panel de docentes.

export type TipoDocumento = "plan_anual" | "plan_semanal" | "plan_diario" | "proyecto";

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: "plan_anual", etiqueta: "Plan anual" },
  { valor: "plan_semanal", etiqueta: "Plan semanal" },
  { valor: "plan_diario", etiqueta: "Plan diario" },
  { valor: "proyecto", etiqueta: "Proyecto" },
];

export function etiquetaTipo(tipo: string): string {
  return TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

export const BUCKET_DOCENTES = "planes-docentes";
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024; // 10 MB por archivo
export const MAX_ARCHIVOS_POR_DOCUMENTO = 10;
export const DIAS_CONSERVACION_PLANES = 45;

export type ArchivoDocumento = { path: string; nombre: string; bytes: number };

/** Fecha en que se borra automáticamente un plan diario o semanal (null si no se borra por antigüedad). */
export function fechaDeBorrado(tipo: string, creadoEn: string): Date | null {
  if (tipo !== "plan_diario" && tipo !== "plan_semanal") return null;
  const f = new Date(creadoEn);
  f.setDate(f.getDate() + DIAS_CONSERVACION_PLANES);
  return f;
}

export function formatoFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const EXTENSIONES_PERMITIDAS = Object.keys(MIME_POR_EXTENSION);

export function extensionDe(nombre: string): string {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

/** Tipo MIME según la extensión (algunos equipos no lo informan bien). */
export function mimeDe(nombre: string): string | null {
  return MIME_POR_EXTENSION[extensionDe(nombre)] ?? null;
}

/** Nombre de archivo sin tildes, espacios ni símbolos raros. */
export function nombreSeguro(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-80);
}

/**
 * Achica una foto (máx. 1500 px de lado, JPG calidad 65%) para que ocupe poco espacio
 * pero la letra manuscrita siga leyéndose bien. Solo funciona en el navegador.
 */
export async function comprimirImagen(archivo: File): Promise<{ blob: Blob; nombre: string }> {
  const MAX_LADO = 1500;
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolver) => canvas.toBlob(resolver, "image/jpeg", 0.65));
  if (!blob) throw new Error("No se pudo procesar la imagen.");

  const base = archivo.name.replace(/\.[^.]+$/, "");
  return { blob, nombre: `${base}.jpg` };
}
