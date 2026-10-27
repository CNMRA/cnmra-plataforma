"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAnioLectivo, ANIO_LECTIVO_ACTIVO } from "@/lib/anio-lectivo";

type Nivel = "colegio" | "curso" | "estudiante";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };

type Aviso = {
  id: string;
  nivel: Nivel;
  curso_id: string | null;
  estudiante_id: string | null;
  titulo: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  contenido: string;
  imagen_url: string | null;
  creado_en: string;
  anio_lectivo: number | null;
  cursos: { grado: string; turno: string; enfasis: string | null } | null;
  estudiantes: { nombre_completo: string } | null;
};

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  colegio: "Todo el colegio",
  curso: "Un curso",
  estudiante: "Un estudiante",
};

const TITULOS_PREESTABLECIDOS = ["Reunión de Padres", "Entrevista", "Comunicado", "Invitación", "Otros"];

export default function AvisosInstitucion() {
  const supabase = createClient();
  const { anio } = useAnioLectivo();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const [nivel, setNivel] = useState<Nivel>("colegio");
  const [cursoId, setCursoId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [tituloElegido, setTituloElegido] = useState("");
  const [tituloOtro, setTituloOtro] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [contenido, setContenido] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("cursos").select("id, grado, turno, enfasis").order("orden").then(({ data }) => setCursos(data ?? []));
    supabase
      .from("estudiantes")
      .select("id, nombre_completo")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes(data ?? []));
  }, [supabase]);

  const cargarHistorial = useCallback(async () => {
    let query = supabase
      .from("avisos")
      .select(
        "id, nivel, curso_id, estudiante_id, titulo, fecha, hora, lugar, contenido, imagen_url, creado_en, anio_lectivo, cursos(grado, turno, enfasis), estudiantes(nombre_completo)"
      )
      .order("creado_en", { ascending: false });

    query =
      anio === ANIO_LECTIVO_ACTIVO
        ? query.or(`anio_lectivo.is.null,anio_lectivo.eq.${ANIO_LECTIVO_ACTIVO}`)
        : query.eq("anio_lectivo", anio);

    const { data } = await query;
    setAvisos((data as unknown as Aviso[]) ?? []);
  }, [supabase, anio]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargarHistorial();
  }, [cargarHistorial]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();

    const titulo = tituloElegido === "Otros" ? tituloOtro.trim() : tituloElegido;

    if (!tituloElegido) {
      setMensaje("Elegí el título del aviso.");
      return;
    }
    if (tituloElegido === "Otros" && !tituloOtro.trim()) {
      setMensaje("Especificá el título del aviso.");
      return;
    }
    if (!contenido.trim()) return;
    if (nivel === "curso" && !cursoId) {
      setMensaje("Elegí un curso.");
      return;
    }
    if (nivel === "estudiante" && !estudianteId) {
      setMensaje("Elegí un estudiante.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    let imagenUrl: string | null = null;
    if (imagen) {
      const nombreArchivo = `${Date.now()}-${imagen.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error: errorSubida } = await supabase.storage.from("avisos").upload(nombreArchivo, imagen);
      if (errorSubida) {
        setMensaje("No se pudo subir la imagen: " + errorSubida.message);
        setGuardando(false);
        return;
      }
      const { data: publica } = supabase.storage.from("avisos").getPublicUrl(nombreArchivo);
      imagenUrl = publica.publicUrl;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("avisos").insert({
      nivel,
      curso_id: nivel === "curso" ? cursoId : null,
      estudiante_id: nivel === "estudiante" ? estudianteId : null,
      titulo,
      fecha: fecha || null,
      hora: hora || null,
      lugar: lugar.trim() || null,
      contenido: contenido.trim(),
      imagen_url: imagenUrl,
      creado_por: user?.id ?? null,
      anio_lectivo: anio,
    });

    if (error) {
      setMensaje("No se pudo publicar: " + error.message);
      setGuardando(false);
      return;
    }

    setTituloElegido("");
    setTituloOtro("");
    setFecha("");
    setHora("");
    setLugar("");
    setContenido("");
    setImagen(null);
    setCursoId("");
    setEstudianteId("");
    setMensaje("Aviso publicado y notificación enviada.");
    setGuardando(false);
    cargarHistorial();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="font-display text-2xl">Avisos</h1>
        <span className="text-xs font-bold text-white bg-navy px-2.5 py-1 rounded-full">Año {anio}</span>
      </div>
      <p className="text-sm text-text-soft -mt-4">Convocatorias, entrevistas y reuniones. Se notifica al celular de las familias.</p>

      {anio !== ANIO_LECTIVO_ACTIVO && (
        <div className="bg-[#EAF0FF] border border-[#C9D8FF] rounded-lg p-3.5 text-[13px] text-navy leading-relaxed -mt-2">
          Lo que publiques acá queda etiquetado como aviso del <strong>{anio}</strong>. Las familias que todavía no
          tienen un hijo/a matriculado ese año no lo van a ver.
        </div>
      )}

      <form onSubmit={publicar} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Dirigido a
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value as Nivel)}
              className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
            >
              <option value="colegio">Todo el colegio</option>
              <option value="curso">Un curso</option>
              <option value="estudiante">Un estudiante</option>
            </select>
          </label>

          {nivel === "curso" && (
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Curso
              <select
                value={cursoId}
                onChange={(e) => setCursoId(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card min-w-[220px]"
              >
                <option value="">Seleccionar curso…</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grado} {c.enfasis ? `— ${c.enfasis}` : ""} — Turno {c.turno}
                  </option>
                ))}
              </select>
            </label>
          )}

          {nivel === "estudiante" && (
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Estudiante
              <select
                value={estudianteId}
                onChange={(e) => setEstudianteId(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card min-w-[220px]"
              >
                <option value="">Seleccionar estudiante…</option>
                {estudiantes.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre_completo}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Título
            <select
              required
              value={tituloElegido}
              onChange={(e) => {
                setTituloElegido(e.target.value);
                if (e.target.value !== "Otros") setTituloOtro("");
              }}
              className="h-11 rounded-lg border border-border px-3 text-sm bg-card min-w-[220px]"
            >
              <option value="">Seleccionar…</option>
              {TITULOS_PREESTABLECIDOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {tituloElegido === "Otros" && (
            <label className="flex flex-col gap-1.5 text-[13px] font-medium flex-1">
              Especificar título
              <input
                required
                value={tituloOtro}
                onChange={(e) => setTituloOtro(e.target.value)}
                className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Hora
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium flex-1">
            Lugar
            <input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Mensaje
          <textarea
            required
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-24"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Imagen (opcional)
          <input type="file" accept="image/*" onChange={(e) => setImagen(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>

        {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}

        <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6 disabled:opacity-60">
          {guardando ? "Publicando…" : "Publicar aviso"}
        </button>
      </form>

      <div>
        <h2 className="text-[13px] font-semibold text-text-soft uppercase tracking-wide mb-3">Historial — {anio}</h2>
        <div className="flex flex-col gap-3">
          {avisos.length === 0 && <p className="text-sm text-text-soft">Todavía no se publicó ningún aviso para el {anio}.</p>}
          {avisos.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#EAF0FF] text-navy">
                  {ETIQUETA_NIVEL[a.nivel]}
                  {a.nivel === "curso" && a.cursos ? ` · ${a.cursos.grado}${a.cursos.enfasis ? ` — ${a.cursos.enfasis}` : ""}` : ""}
                  {a.nivel === "estudiante" && a.estudiantes ? ` · ${a.estudiantes.nombre_completo}` : ""}
                </span>
                <span className="text-xs text-text-soft">{new Date(a.creado_en).toLocaleString("es-PY")}</span>
              </div>
              <div className="font-semibold text-sm">{a.titulo}</div>
              <div className="text-xs text-text-soft">
                {a.fecha ?? "Sin fecha"} {a.hora ? `· ${a.hora}` : ""} {a.lugar ? `· ${a.lugar}` : ""}
              </div>
              <p className="text-sm">{a.contenido}</p>
              {a.imagen_url && (
                // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el usuario a Supabase Storage, no es un asset del proyecto
                <img src={a.imagen_url} alt="" className="rounded-lg max-h-48 object-contain border border-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
