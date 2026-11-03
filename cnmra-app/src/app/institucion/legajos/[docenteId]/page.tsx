"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOCENTES, etiquetaTipo, formatoFecha, formatoTamano, type ArchivoDocumento } from "@/lib/docentes";

type Titulo = { titulo: string; institucion: string; anio: string; path: string | null; nombre: string | null };
type Asignacion = {
  ciclo: string;
  turno: string;
  grado: string;
  enfasis: string | null;
  materia: string;
};
type ArchivoLegajo = { path: string; nombre: string };

type Legajo = {
  nombres: string | null;
  apellidos: string | null;
  ci: string | null;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  estado_civil: string | null;
  nacionalidad: string | null;
  domicilio: string | null;
  telefono: string | null;
  telefono2: string | null;
  correo: string | null;
  matricula: string | null;
  fecha_ingreso: string | null;
  cargo: string | null;
  situacion: string | null;
  horas_catedra: number | null;
  emergencia_nombre: string | null;
  emergencia_telefono: string | null;
  capacitaciones: string | null;
  experiencia: string | null;
  titulos: Titulo[] | null;
  asignaciones: Asignacion[] | null;
  documentos: Partial<Record<"cedula" | "certificacion" | "constancia", ArchivoLegajo>> | null;
  foto_path: string | null;
  enviado: boolean;
  enviado_en: string | null;
};

type Documento = {
  id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  fecha: string;
  archivos: ArchivoDocumento[];
  cursos: { grado: string; turno: string; enfasis: string | null } | null;
};

function fecha(v: string | null): string {
  return v ? formatoFecha(new Date(v + "T00:00:00")) : "—";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div className="border-b border-border/60 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-text-soft">{etiqueta}</div>
      <div className="text-[13px] font-medium break-words">{valor === null || valor === undefined || valor === "" ? "—" : valor}</div>
    </div>
  );
}

export default function FichaLegajoPage() {
  const { docenteId } = useParams<{ docenteId: string }>();
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [esDirector, setEsDirector] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [legajo, setLegajo] = useState<Legajo | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: yo } = await supabase.from("perfiles").select("rol, acompanamiento").eq("id", user.id).single();
    const permitido = yo?.rol === "director" || (yo?.rol === "carga_datos" && yo?.acompanamiento === true);
    if (!permitido) {
      setEsDirector(false);
      setCargando(false);
      return;
    }
    setEsDirector(true);

    const [{ data: perfil }, { data: leg }, { data: docs }] = await Promise.all([
      supabase.from("perfiles").select("nombre_completo").eq("id", docenteId).maybeSingle(),
      supabase.from("legajos_docentes").select("*").eq("docente_id", docenteId).maybeSingle(),
      supabase
        .from("documentos_docentes")
        .select("id, tipo, titulo, materia, fecha, archivos, cursos(grado, turno, enfasis)")
        .eq("docente_id", docenteId)
        .order("creado_en", { ascending: false }),
    ]);
    setNombrePerfil(perfil?.nombre_completo ?? "");
    setLegajo((leg as Legajo | null) ?? null);
    setDocumentos((docs as unknown as Documento[]) ?? []);
    const foto = (leg as Legajo | null)?.foto_path;
    if (foto) {
      const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(foto, 3600);
      setFotoUrl(data?.signedUrl ?? null);
    }
    setCargando(false);
  }, [supabase, docenteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la ficha
    cargar();
  }, [cargar]);

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (!data?.signedUrl) {
      ventana?.close();
      setMensaje("No se pudo abrir el archivo.");
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (!esDirector) {
    return <div className="bg-card border border-border rounded-xl p-6 text-sm">Solo Dirección o el acompañamiento docente pueden ver esta sección.</div>;
  }

  const volver = (
    <Link href="/institucion/legajos" className="text-sm text-navy font-medium print:hidden self-start">
      ← Volver a la lista
    </Link>
  );

  if (!legajo) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <div className="bg-card border border-border rounded-xl p-6 text-sm">
          <b>{nombrePerfil || "Este docente"}</b> todavía no empezó su legajo.
        </div>
      </div>
    );
  }

  const nombreCompleto = [legajo.nombres, legajo.apellidos].filter(Boolean).join(" ") || nombrePerfil;
  const titulos = legajo.titulos ?? [];
  const asignaciones = legajo.asignaciones ?? [];
  const docsPersonal: { etiqueta: string; archivo?: ArchivoLegajo }[] = [
    { etiqueta: "Cédula de identidad", archivo: legajo.documentos?.cedula },
    { etiqueta: "Certificación documental actual (SIGMEC)", archivo: legajo.documentos?.certificacion },
    { etiqueta: "Constancia de cargo actual (SIGMEC)", archivo: legajo.documentos?.constancia },
  ];

  return (
    <div className="flex flex-col gap-5">
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {volver}
        <button onClick={() => window.print()} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
          Imprimir legajo
        </button>
      </div>

      {mensaje && (
        <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2 print:hidden">{mensaje}</div>
      )}

      {/* ===== Hoja imprimible ===== */}
      <div className="bg-card border border-border rounded-xl p-6 print:border-0 print:p-0 print:rounded-none flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 border-b-2 border-navy pb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-soft">
              Colegio Nacional Mariano Roque Alonso
            </div>
            <h1 className="font-display text-2xl leading-tight">Legajo docente</h1>
            <div className="text-lg font-semibold mt-1">{nombreCompleto}</div>
            <div className="text-xs text-text-soft mt-0.5">
              {legajo.enviado ? `Legajo enviado el ${legajo.enviado_en ? new Date(legajo.enviado_en).toLocaleDateString("es-PY") : "—"}` : "Legajo en borrador (no enviado)"}
            </div>
          </div>
          <div className="w-24 h-32 border border-border rounded-md overflow-hidden bg-bg flex-none flex items-center justify-center text-[10px] text-text-soft text-center">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto privada con URL firmada
              <img src={fotoUrl} alt="Foto" className="w-full h-full object-cover" />
            ) : (
              "Sin foto"
            )}
          </div>
        </div>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Datos personales</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5">
            <Dato etiqueta="Nombres" valor={legajo.nombres} />
            <Dato etiqueta="Apellidos" valor={legajo.apellidos} />
            <Dato etiqueta="Cédula de identidad" valor={legajo.ci} />
            <Dato etiqueta="Fecha de nacimiento" valor={fecha(legajo.fecha_nacimiento)} />
            <Dato etiqueta="Lugar de nacimiento" valor={legajo.lugar_nacimiento} />
            <Dato etiqueta="Estado civil" valor={legajo.estado_civil} />
            <Dato etiqueta="Nacionalidad" valor={legajo.nacionalidad} />
            <Dato etiqueta="Domicilio" valor={legajo.domicilio} />
            <Dato etiqueta="Teléfono" valor={legajo.telefono} />
            <Dato etiqueta="Otro teléfono" valor={legajo.telefono2} />
            <Dato etiqueta="Correo electrónico" valor={legajo.correo} />
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Datos en el colegio</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5">
            <Dato etiqueta="Matrícula / registro docente" valor={legajo.matricula} />
            <Dato etiqueta="Fecha de ingreso" valor={fecha(legajo.fecha_ingreso)} />
            <Dato etiqueta="Cargo" valor={legajo.cargo} />
            <Dato etiqueta="Situación" valor={legajo.situacion} />
            <Dato etiqueta="Horas cátedra semanales" valor={legajo.horas_catedra} />
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Materias que dicta</h2>
          {asignaciones.length === 0 ? (
            <div className="text-[13px] text-text-soft">—</div>
          ) : (
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-text-soft border-b border-border">
                  <th className="py-1 pr-2">Año</th>
                  <th className="py-1 pr-2">Turno</th>
                  <th className="py-1 pr-2">Curso</th>
                  <th className="py-1">Materia</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((a, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-1 pr-2">{a.ciclo}</td>
                    <td className="py-1 pr-2">{a.turno}</td>
                    <td className="py-1 pr-2">
                      {a.grado}
                      {a.enfasis ? ` — ${a.enfasis}` : ""}
                    </td>
                    <td className="py-1 font-medium">{a.materia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Títulos obtenidos</h2>
          {titulos.length === 0 ? (
            <div className="text-[13px] text-text-soft">—</div>
          ) : (
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-text-soft border-b border-border">
                  <th className="py-1 pr-2">Título</th>
                  <th className="py-1 pr-2">Institución</th>
                  <th className="py-1 pr-2">Año</th>
                  <th className="py-1 print:hidden">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((t, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-1 pr-2 font-medium">{t.titulo || "—"}</td>
                    <td className="py-1 pr-2">{t.institucion || "—"}</td>
                    <td className="py-1 pr-2">{t.anio || "—"}</td>
                    <td className="py-1 print:hidden">
                      {t.path ? (
                        <button onClick={() => abrirArchivo(t.path as string)} className="text-xs text-navy font-medium">
                          Ver
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Documentos del personal</h2>
          <table className="w-full text-[12.5px] border-collapse">
            <tbody>
              {docsPersonal.map((d) => (
                <tr key={d.etiqueta} className="border-b border-border/60">
                  <td className="py-1 pr-2">{d.etiqueta}</td>
                  <td className="py-1 pr-2 font-medium">{d.archivo ? "Presentado" : "No presentado"}</td>
                  <td className="py-1 text-right print:hidden">
                    {d.archivo && (
                      <button onClick={() => abrirArchivo(d.archivo!.path)} className="text-xs text-navy font-medium">
                        Ver archivo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Contacto de emergencia</h2>
          <div className="grid grid-cols-2 gap-x-5">
            <Dato etiqueta="Nombre" valor={legajo.emergencia_nombre} />
            <Dato etiqueta="Teléfono" valor={legajo.emergencia_telefono} />
          </div>
        </section>

        {(legajo.capacitaciones || legajo.experiencia) && (
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy mb-1">Otros datos</h2>
            {legajo.capacitaciones && (
              <div className="py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-text-soft">Cursos y capacitaciones</div>
                <div className="text-[13px] whitespace-pre-wrap">{legajo.capacitaciones}</div>
              </div>
            )}
            {legajo.experiencia && (
              <div className="py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-text-soft">Experiencia laboral anterior</div>
                <div className="text-[13px] whitespace-pre-wrap">{legajo.experiencia}</div>
              </div>
            )}
          </section>
        )}

        <div className="hidden print:grid grid-cols-2 gap-16 pt-16 text-center text-[12px]">
          <div className="border-t border-black pt-1">Firma del docente</div>
          <div className="border-t border-black pt-1">Firma y sello de Dirección</div>
        </div>
      </div>

      {/* ===== Solo en pantalla: planes y proyectos subidos ===== */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 print:hidden">
        <h2 className="font-semibold">Planes y proyectos subidos ({documentos.length})</h2>
        {documentos.length === 0 ? (
          <p className="text-sm text-text-soft">Todavía no subió ningún documento.</p>
        ) : (
          documentos.map((d) => (
            <div key={d.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div>
                <div className="font-semibold text-[14px]">{d.titulo}</div>
                <div className="text-xs text-text-soft">
                  {etiquetaTipo(d.tipo)}
                  {d.materia ? ` · ${d.materia}` : ""}
                  {d.cursos ? ` · ${d.cursos.grado}${d.cursos.enfasis ? ` — ${d.cursos.enfasis}` : ""} (${d.cursos.turno})` : ""}
                  {" · "}
                  {formatoFecha(new Date(d.fecha + "T00:00:00"))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(d.archivos ?? []).map((a) => (
                  <button
                    key={a.path}
                    onClick={() => abrirArchivo(a.path)}
                    className="text-xs bg-bg border border-border rounded-full px-3 py-1 text-left"
                  >
                    {a.nombre} · {formatoTamano(a.bytes)}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
