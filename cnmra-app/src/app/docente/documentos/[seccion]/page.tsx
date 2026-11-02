"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET_DOCENTES,
  DIAS_CONSERVACION_PLANES,
  EXTENSIONES_PERMITIDAS,
  MAX_ARCHIVOS_POR_DOCUMENTO,
  MAX_BYTES_ARCHIVO,
  comprimirImagen,
  etiquetaTipo,
  extensionDe,
  formatoFecha,
  formatoTamano,
  mimeDe,
  nombreSeguro,
  type ArchivoDocumento,
} from "@/lib/docentes";

type PaginaJpeg = { bytes: Uint8Array; ancho: number; alto: number };

/** Arma un PDF simple con una foto (JPEG) por página, sin librerías externas. */
function construirPdf(paginas: PaginaJpeg[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let largo = 0;

  const poner = (dato: Uint8Array | string) => {
    const b = typeof dato === "string" ? enc.encode(dato) : dato;
    partes.push(b);
    largo += b.length;
  };
  const abrir = (n: number) => {
    offsets[n] = largo;
  };

  const total = 2 + paginas.length * 3;
  poner("%PDF-1.4\n");

  abrir(1);
  poner("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const hijos = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  abrir(2);
  poner(`2 0 obj\n<< /Type /Pages /Kids [${hijos}] /Count ${paginas.length} >>\nendobj\n`);

  paginas.forEach((p, i) => {
    const idPagina = 3 + i * 3;
    const idContenido = idPagina + 1;
    const idImagen = idPagina + 2;
    const escala = 842 / Math.max(p.ancho, p.alto);
    const ancho = (p.ancho * escala).toFixed(2);
    const alto = (p.alto * escala).toFixed(2);

    abrir(idPagina);
    poner(
      `${idPagina} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] ` +
        `/Resources << /XObject << /Im0 ${idImagen} 0 R >> >> /Contents ${idContenido} 0 R >>\nendobj\n`
    );

    const contenido = `q ${ancho} 0 0 ${alto} 0 0 cm /Im0 Do Q`;
    abrir(idContenido);
    poner(`${idContenido} 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`);

    abrir(idImagen);
    poner(
      `${idImagen} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.ancho} /Height ${p.alto} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
    );
    poner(p.bytes);
    poner("\nendstream\nendobj\n");
  });

  const inicioXref = largo;
  poner(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) {
    poner(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  poner(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);

  return new Blob(partes as unknown as BlobPart[], { type: "application/pdf" });
}

type Asignacion = {
  ciclo: string;
  turno: string;
  curso_id: string;
  grado: string;
  enfasis: string | null;
  disciplina_id: string;
  materia: string;
};

type Documento = {
  id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  curso_id: string | null;
  fecha: string;
  creado_en: string;
  archivos: ArchivoDocumento[];
};

type Seccion = {
  titulo: string;
  descripcion: string;
  tipos: { valor: string; etiqueta: string }[];
  temporal: boolean;
};

const SECCIONES: Record<string, Seccion> = {
  anual: {
    titulo: "Plan anual",
    descripcion: "Subí el plan anual de cada una de tus materias.",
    tipos: [{ valor: "plan_anual", etiqueta: "Plan anual" }],
    temporal: false,
  },
  proyectos: {
    titulo: "Proyectos",
    descripcion: "Subí los proyectos que presentás en cada materia.",
    tipos: [{ valor: "proyecto", etiqueta: "Proyecto" }],
    temporal: true,
  },
  diario: {
    titulo: "Plan diario",
    descripcion: "Subí tus planes diarios o semanales de cada materia.",
    tipos: [
      { valor: "plan_diario", etiqueta: "Plan diario" },
      { valor: "plan_semanal", etiqueta: "Plan semanal" },
    ],
    temporal: true,
  },
};

function hoy(): string {
  return new Date().toLocaleDateString("en-CA");
}

function nombreCurso(a: Asignacion): string {
  return `${a.grado}${a.enfasis ? ` — ${a.enfasis}` : ""} · Turno ${a.turno} · ${a.ciclo}`;
}

export default function SeccionDocumentosPage() {
  const { seccion: clave } = useParams<{ seccion: string }>();
  const seccion = SECCIONES[clave];
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [uid, setUid] = useState("");
  const [habilitado, setHabilitado] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);

  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [archivos, setArchivos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!seccion) {
      setCargando(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);

    const { data: leg } = await supabase
      .from("legajos_docentes")
      .select("asignaciones, enviado, habilitado_por_direccion")
      .eq("docente_id", user.id)
      .maybeSingle();
    setHabilitado(Boolean(leg && (leg.enviado || leg.habilitado_por_direccion)));
    setAsignaciones(((leg?.asignaciones as Asignacion[] | null) ?? []).slice());

    const { data: docs } = await supabase
      .from("documentos_docentes")
      .select("id, tipo, titulo, materia, curso_id, fecha, creado_en, archivos")
      .in(
        "tipo",
        seccion.tipos.map((t) => t.valor)
      )
      .order("creado_en", { ascending: false });
    setDocumentos((docs as unknown as Documento[]) ?? []);
    setCargando(false);
  }, [supabase, seccion]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de materias y documentos
    cargar();
  }, [cargar]);

  function elegir(i: number) {
    const a = asignaciones[i];
    const primerTipo = seccion.tipos[0];
    setElegida(i);
    setTipo(primerTipo.valor);
    setTitulo(clave === "anual" ? `Plan anual ${a.ciclo} - ${a.materia}` : "");
    setFecha(hoy());
    setArchivos([]);
    setMensaje(null);
  }

  function agregarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? []);
    e.target.value = "";
    setArchivos((previos) => [...previos, ...nuevos]);
  }

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (!data?.signedUrl) {
      ventana?.close();
      setMensaje({ tipo: "error", texto: "No se pudo abrir el archivo." });
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  async function subir() {
    if (elegida === null) return;
    const a = asignaciones[elegida];
    setMensaje(null);

    if (!titulo.trim()) {
      setMensaje({ tipo: "error", texto: "Escribí un título." });
      return;
    }
    if (archivos.length === 0) {
      setMensaje({ tipo: "error", texto: "Agregá al menos una foto o un archivo." });
      return;
    }
    if (archivos.length > MAX_ARCHIVOS_POR_DOCUMENTO) {
      setMensaje({ tipo: "error", texto: `Podés subir hasta ${MAX_ARCHIVOS_POR_DOCUMENTO} archivos por documento.` });
      return;
    }
    const imagenes = archivos.filter((f) => f.type.startsWith("image/"));
    const otros = archivos.filter((f) => !f.type.startsWith("image/"));
    for (const f of otros) {
      if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(f.name))) {
        setMensaje({ tipo: "error", texto: `"${f.name}" no es un formato permitido (fotos, PDF o Word).` });
        return;
      }
      if (f.size > MAX_BYTES_ARCHIVO) {
        setMensaje({ tipo: "error", texto: `"${f.name}" pesa más de 10 MB.` });
        return;
      }
    }

    const subidos: ArchivoDocumento[] = [];
    try {
      const carpeta = `${uid}/${tipo}`;
      const marca = Date.now();

      if (imagenes.length > 0) {
        setSubiendo("Preparando las fotos…");
        const paginas: PaginaJpeg[] = [];
        for (const img of imagenes) {
          const { blob } = await comprimirImagen(img);
          const bmp = await createImageBitmap(blob);
          const ancho = bmp.width;
          const alto = bmp.height;
          bmp.close();
          paginas.push({ bytes: new Uint8Array(await blob.arrayBuffer()), ancho, alto });
        }
        const pdf = construirPdf(paginas);
        if (pdf.size > MAX_BYTES_ARCHIVO) {
          throw new Error("Las fotos juntas pesan más de 10 MB. Subí menos fotos por documento.");
        }
        setSubiendo("Subiendo…");
        const nombre = `${nombreSeguro(titulo.trim())}.pdf`;
        const path = `${carpeta}/${marca}-${nombre}`;
        const { error } = await supabase.storage.from(BUCKET_DOCENTES).upload(path, pdf, { contentType: "application/pdf" });
        if (error) throw new Error(error.message);
        subidos.push({ path, nombre, bytes: pdf.size });
      }

      for (let i = 0; i < otros.length; i++) {
        const f = otros[i];
        setSubiendo("Subiendo…");
        const nombre = nombreSeguro(f.name);
        const path = `${carpeta}/${marca}-${i}-${nombre}`;
        const { error } = await supabase.storage
          .from(BUCKET_DOCENTES)
          .upload(path, f, { contentType: mimeDe(f.name) ?? "application/octet-stream" });
        if (error) throw new Error(error.message);
        subidos.push({ path, nombre: f.name, bytes: f.size });
      }

      const { error: errFila } = await supabase.from("documentos_docentes").insert({
        docente_id: uid,
        curso_id: a.curso_id,
        materia: a.materia,
        tipo,
        titulo: titulo.trim(),
        fecha,
        archivos: subidos,
      });
      if (errFila) throw new Error(errFila.message);

      setArchivos([]);
      setTitulo(clave === "anual" ? `Plan anual ${a.ciclo} - ${a.materia}` : "");
      setMensaje({ tipo: "ok", texto: "¡Listo! Se guardó tu documento." });
      await cargar();
    } catch (err) {
      if (subidos.length > 0) await supabase.storage.from(BUCKET_DOCENTES).remove(subidos.map((s) => s.path));
      setMensaje({ tipo: "error", texto: "No se pudo subir: " + (err as Error).message });
    }
    setSubiendo(null);
  }

  async function eliminar(doc: Documento) {
    if (!window.confirm(`¿Eliminar "${doc.titulo}" y sus archivos? Esto no se puede deshacer.`)) return;
    setMensaje(null);
    const paths = (doc.archivos ?? []).map((x) => x.path);
    if (paths.length > 0) {
      const { error } = await supabase.storage.from(BUCKET_DOCENTES).remove(paths);
      if (error) {
        setMensaje({ tipo: "error", texto: "No se pudieron borrar los archivos: " + error.message });
        return;
      }
    }
    const { error } = await supabase.from("documentos_docentes").delete().eq("id", doc.id);
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo eliminar: " + error.message });
      return;
    }
    cargar();
  }

  function fechaBorrado(doc: Documento): string | null {
    if (!seccion.temporal) return null;
    const f = new Date(doc.creado_en);
    f.setDate(f.getDate() + DIAS_CONSERVACION_PLANES);
    return formatoFecha(f);
  }

  if (!seccion) return <p className="text-sm text-text-soft">Esta sección no existe.</p>;
  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (!habilitado) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm flex flex-col gap-3">
        <p>Para usar esta sección tenés que completar y enviar tu legajo.</p>
        <Link href="/docente/legajo" className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 flex items-center self-start">
          Ir a Mi legajo
        </Link>
      </div>
    );
  }

  const encabezado = (
    <div>
      <h1 className="font-display text-2xl">{seccion.titulo}</h1>
      <p className="text-sm text-text-soft mt-1">{seccion.descripcion}</p>
      <p className="text-xs text-text-soft mt-1">
        {seccion.temporal
          ? `Los archivos se eliminan automáticamente a los ${DIAS_CONSERVACION_PLANES} días.`
          : "Se conservan hasta el cierre del año."}
      </p>
    </div>
  );

  const avisoMensaje = mensaje && (
    <div
      className={`text-sm rounded-lg px-3 py-2 border ${
        mensaje.tipo === "ok" ? "text-teal bg-green-50 border-green-200" : "text-danger bg-red-50 border-red-200"
      }`}
    >
      {mensaje.texto}
    </div>
  );

  if (asignaciones.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {encabezado}
        <div className="bg-card border border-border rounded-xl p-6 text-sm flex flex-col gap-3">
          <p>Todavía no cargaste ninguna materia. Agregalas en tu legajo (sección &ldquo;Qué enseño&rdquo;).</p>
          <Link href="/docente/legajo" className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 flex items-center self-start">
            Ir a Mi legajo
          </Link>
        </div>
      </div>
    );
  }

  if (elegida === null || !asignaciones[elegida]) {
    return (
      <div className="flex flex-col gap-5">
        {encabezado}
        {avisoMensaje}
        <div className="grid sm:grid-cols-2 gap-4">
          {asignaciones.map((a, i) => {
            const cantidad = documentos.filter((d) => d.curso_id === a.curso_id && d.materia === a.materia).length;
            return (
              <button
                key={`${a.curso_id}-${a.disciplina_id}`}
                onClick={() => elegir(i)}
                className="text-left bg-card border border-border rounded-2xl p-5 flex flex-col gap-1.5 hover:border-teal hover:shadow-sm transition"
              >
                <div className="font-display font-bold text-lg leading-tight">{a.materia}</div>
                <div className="text-xs text-text-soft">{nombreCurso(a)}</div>
                <div className="text-xs mt-1 text-navy font-medium">
                  {cantidad === 0 ? "Sin documentos todavía" : `${cantidad} documento${cantidad === 1 ? "" : "s"}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const a = asignaciones[elegida];
  const docsDeEsta = documentos.filter((d) => d.curso_id === a.curso_id && d.materia === a.materia);

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => setElegida(null)} className="text-sm text-navy font-medium self-start">
        ← Volver a mis materias
      </button>
      <div>
        <h1 className="font-display text-2xl">
          {seccion.titulo} · {a.materia}
        </h1>
        <p className="text-sm text-text-soft mt-1">{nombreCurso(a)}</p>
      </div>

      {avisoMensaje}

      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="font-semibold">Subir un documento</h2>

        {seccion.tipos.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg w-full"
            >
              {seccion.tipos.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={clave === "diario" ? "Ej.: Plan del 3 al 7 de noviembre" : "Título del documento"}
            className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg w-full"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg w-full"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-medium">Fotos o archivos</div>
          <p className="text-xs text-text-soft">
            Si sacás fotos, se juntan solas en <b>un solo PDF</b>, en el orden en que las agregues. También podés subir un
            PDF o un Word (si es Word, mejor guardalo como PDF). Máximo {MAX_ARCHIVOS_POR_DOCUMENTO} archivos y 10 MB cada
            uno. No se permiten videos.
          </p>
          <label className="h-10 rounded-lg border border-border px-4 flex items-center text-sm font-medium cursor-pointer bg-bg self-start">
            + Agregar fotos o archivos
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={agregarArchivos}
              className="hidden"
            />
          </label>
          {archivos.length > 0 && (
            <div className="flex flex-col divide-y divide-border border border-border rounded-lg">
              {archivos.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">
                    {i + 1}. {f.name} <span className="text-xs text-text-soft">({formatoTamano(f.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setArchivos(archivos.filter((_, n) => n !== i))}
                    className="text-xs text-danger font-medium flex-none"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={subir}
          disabled={subiendo !== null}
          className="h-11 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-60"
        >
          {subiendo ?? "Subir documento"}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Lo que ya subiste ({docsDeEsta.length})</h2>
        {docsDeEsta.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
            Todavía no subiste nada en esta materia.
          </div>
        ) : (
          docsDeEsta.map((doc) => {
            const borrado = fechaBorrado(doc);
            return (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[15px]">{doc.titulo}</div>
                    <div className="text-xs text-text-soft mt-0.5">
                      {etiquetaTipo(doc.tipo)} · {formatoFecha(new Date(doc.fecha + "T00:00:00"))}
                    </div>
                  </div>
                  <button onClick={() => eliminar(doc)} className="text-xs text-danger font-medium">
                    Eliminar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(doc.archivos ?? []).map((x) => (
                    <button
                      key={x.path}
                      onClick={() => abrirArchivo(x.path)}
                      className="text-xs bg-bg border border-border rounded-full px-3 py-1 text-left"
                    >
                      {x.nombre} · {formatoTamano(x.bytes)}
                    </button>
                  ))}
                </div>
                {borrado && <div className="text-[11px] text-text-soft">Se eliminará automáticamente el {borrado}.</div>}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
