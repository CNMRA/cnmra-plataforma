// Ayudantes para hablar con Google Drive (solo se usa en el servidor).

const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";

export async function tokenGoogle(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const d = (await r.json()) as { access_token?: string; error_description?: string };
  if (!r.ok || !d.access_token) throw new Error(d.error_description ?? "No se pudo conectar con Google.");
  return d.access_token;
}

function escapar(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Busca una carpeta por nombre dentro de otra; si no existe, la crea. */
export async function carpeta(token: string, padre: string, nombre: string, memoria: Map<string, string>): Promise<string> {
  const clave = `${padre}/${nombre}`;
  const guardada = memoria.get(clave);
  if (guardada) return guardada;
  const cab = { Authorization: `Bearer ${token}` };
  const q = `name='${escapar(nombre)}' and '${padre}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const b = await fetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: cab });
  const busqueda = (await b.json()) as { files?: { id: string }[] };
  let id = busqueda.files?.[0]?.id;
  if (!id) {
    const c = await fetch(`${API}/files?fields=id`, {
      method: "POST",
      headers: { ...cab, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre, mimeType: "application/vnd.google-apps.folder", parents: [padre] }),
    });
    const creada = (await c.json()) as { id?: string };
    if (!c.ok || !creada.id) throw new Error("No se pudo crear la carpeta " + nombre);
    id = creada.id;
  }
  memoria.set(clave, id);
  return id;
}

export async function subirArchivo(token: string, padre: string, nombre: string, mime: string, datos: ArrayBuffer): Promise<string> {
  const limite = "cnmra" + Date.now().toString(36);
  const meta = JSON.stringify({ name: nombre, parents: [padre] });
  const cabeza = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`;
  const cuerpo = Buffer.concat([Buffer.from(cabeza), Buffer.from(datos), Buffer.from(`\r\n--${limite}--`)]);
  const r = await fetch(SUBIDA, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  const d = (await r.json()) as { id?: string };
  if (!r.ok || !d.id) throw new Error("Google rechazó el archivo " + nombre);
  return d.id;
}
