"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };
type AsistenciaFila = { estudiante_id: string; fecha: string; estado: string };
type DiaSinClase = { id: string; fecha: string; motivo: string };

const CODIGO: Record<string, string> = {
  presente: "P",
  ausente: "A",
  tardanza: "T",
  justificado: "J",
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const MOTIVOS_PRESET = ["Feriado", "Jornada sindical", "Reunión", "Lluvia", "Otro"];

type Situacion = {
  etiqueta: string;
  claseTexto: string;
};

function mesActualISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function calcularSituacion(pct: number | null): Situacion {
  if (pct === null) return { etiqueta: "—", claseTexto: "text-text-soft" };
  if (pct >= 95) return { etiqueta: "Plena", claseTexto: "text-teal font-semibold" };
  if (pct >= 80) return { etiqueta: "Regular", claseTexto: "text-navy font-semibold" };
  if (pct >= 65) return { etiqueta: "Irregular", claseTexto: "text-warning font-semibold" };
  if (pct >= 50) return { etiqueta: "Reiterada", claseTexto: "text-danger font-semibold" };
  return { etiqueta: "Grave", claseTexto: "text-danger font-bold" };
}

const ETIQUETA_LARGA: Record<string, string> = {
  Plena: "Asistencia Plena",
  Regular: "Asistencia Regular",
  Irregular: "Asistencia Irregular",
  Reiterada: "Inasistencia reiterada",
  Grave: "Inasistencia grave",
};

export default function ReporteAsistenciaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [mes, setMes] = useState(mesActualISO());
  const [filas, setFilas] = useState<AsistenciaFila[]>([]);
  const [diasSinClase, setDiasSinClase] = useState<DiaSinClase[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("Feriado");
  const [nuevoMotivoOtro, setNuevoMotivoOtro] = useState("");
  const [guardandoDia, setGuardandoDia] = useState(false);
  const [mensajeDia, setMensajeDia] = useState<string | null>(null);

  const cargarBase = useCallback(async () => {
    const { data: cursoData } = await supabase
      .from("cursos")
      .select("id, grado, turno, ciclo, enfasis")
      .eq("id", cursoId)
      .single();
    setCurso(cursoData ?? null);

    const { data: seccionesData } = await supabase.from("secciones").select("id").eq("curso_id", cursoId);
    const seccionIds = (seccionesData ?? []).map((s) => s.id);

    const { data: estudiantesData } = seccionIds.length
      ? await supabase
          .from("estudiantes")
          .select("id, nombre_completo")
          .in("seccion_id", seccionIds)
          .eq("estado", "activo")
          .order("nombre_completo")
      : { data: [] };
    setEstudiantes(estudiantesData ?? []);
    setCargando(false);
  }, [cursoId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargarBase();
  }, [cargarBase]);

  const [anio, mesNum] = mes.split("-").map(Number);
  const diasDelMes = new Date(anio, mesNum, 0).getDate();
  const primerDia = `${mes}-01`;
  const ultimoDia = `${mes}-${String(diasDelMes).padStart(2, "0")}`;

  const cargarAsistencias = useCallback(async () => {
    if (estudiantes.length === 0) {
      setFilas([]);
      return;
    }
    const { data } = await supabase
      .from("asistencias")
      .select("estudiante_id, fecha, estado")
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      .in("estudiante_id", estudiantes.map((e) => e.id));
    setFilas(data ?? []);
  }, [estudiantes, primerDia, ultimoDia, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de asistencias del mes seleccionado
    cargarAsistencias();
  }, [cargarAsistencias]);

  const cargarDiasSinClase = useCallback(async () => {
    const { data } = await supabase
      .from("dias_sin_clase")
      .select("id, fecha, motivo")
      .eq("curso_id", cursoId)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      .order("fecha");
    setDiasSinClase(data ?? []);
  }, [cursoId, primerDia, ultimoDia, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de días sin clase del mes seleccionado
    cargarDiasSinClase();
  }, [cargarDiasSinClase]);

  const mapa = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    filas.forEach((f) => {
      const dia = Number(f.fecha.slice(8, 10));
      if (!m.has(f.estudiante_id)) m.set(f.estudiante_id, new Map());
      m.get(f.estudiante_id)!.set(dia, CODIGO[f.estado] ?? "?");
    });
    return m;
  }, [filas]);

  const sinClaseMapa = useMemo(() => {
    const m = new Map<number, string>();
    diasSinClase.forEach((d) => {
      const dia = Number(d.fecha.slice(8, 10));
      m.set(dia, d.motivo);
    });
    return m;
  }, [diasSinClase]);

  const dias = Array.from({ length: diasDelMes }, (_, i) => i + 1).filter((d) => {
    const diaSemana = new Date(anio, mesNum - 1, d).getDay();
    return diaSemana !== 0 && diaSemana !== 6; // se excluyen sábados y domingos
  });
  const nombreMes = new Date(anio, mesNum - 1, 1).toLocaleDateString("es-PY", { month: "long", year: "numeric" });

  async function agregarDiaSinClase(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaFecha) {
      setMensajeDia("Elegí una fecha.");
      return;
    }
    const motivoFinal = nuevoMotivo === "Otro" ? nuevoMotivoOtro.trim() : nuevoMotivo;
    if (!motivoFinal) {
      setMensajeDia("Escribí el motivo.");
      return;
    }
    setGuardandoDia(true);
    setMensajeDia(null);
    const { error } = await supabase.from("dias_sin_clase").insert({
      curso_id: cursoId,
      fecha: nuevaFecha,
      motivo: motivoFinal,
    });
    setGuardandoDia(false);
    if (error) {
      setMensajeDia(
        error.code === "23505" ? "Ya hay un motivo cargado para esa fecha." : "No se pudo guardar: " + error.message
      );
      return;
    }
    setNuevaFecha("");
    setNuevoMotivo("Feriado");
    setNuevoMotivoOtro("");
    cargarDiasSinClase();
  }

  async function eliminarDiaSinClase(id: string) {
    await supabase.from("dias_sin_clase").delete().eq("id", id);
    cargarDiasSinClase();
  }

  const resumenCurso = useMemo(() => {
    const conteo: Record<string, number> = {
      Plena: 0,
      Regular: 0,
      Irregular: 0,
      Reiterada: 0,
      Grave: 0,
    };
    let consideradas = 0;
    estudiantes.forEach((e) => {
      const fila = mapa.get(e.id);
      let presentesOTardanzas = 0;
      let registrados = 0;
      dias.forEach((d) => {
        if (sinClaseMapa.has(d)) return;
        const c = fila?.get(d);
        if (!c) return;
        registrados += 1;
        if (c === "P" || c === "T") presentesOTardanzas += 1;
      });
      if (registrados === 0) return;
      const pct = (presentesOTardanzas / registrados) * 100;
      const { etiqueta } = calcularSituacion(pct);
      if (etiqueta in conteo) {
        conteo[etiqueta] += 1;
        consideradas += 1;
      }
    });
    return { conteo, consideradas };
  }, [estudiantes, mapa, dias, sinClaseMapa]);

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      <div className="print:hidden flex flex-col gap-3">
        <Link href={`/institucion/cursos/${cursoId}`} className="text-xs text-teal font-medium">
          ← Volver al curso
        </Link>
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="font-display text-2xl">Reporte de asistencia</h1>
            <p className="text-sm text-text-soft mt-1">
              {curso ? `${curso.grado} · ${etiquetaTurno[curso.turno] ?? curso.turno}` : ""}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Mes
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
              />
            </label>
            <button onClick={() => window.print()} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Días sin clases este mes</h2>
          <p className="text-xs text-text-soft -mt-2">
            Marcá acá los feriados, jornadas sindicales, reuniones, días de lluvia, etc. Esos días no van a contar
            para el cálculo del % de asistencia y van a aparecer con un asterisco en la planilla.
          </p>

          {diasSinClase.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {diasSinClase.map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-2 text-xs bg-bg border border-border rounded-full pl-3 pr-1.5 py-1"
                >
                  {Number(d.fecha.slice(8, 10))} de {nombreMes.split(" ")[0]} — {d.motivo}
                  <button
                    type="button"
                    onClick={() => eliminarDiaSinClase(d.id)}
                    className="w-5 h-5 rounded-full bg-border text-text-soft font-bold leading-none"
                    aria-label={`Quitar día ${d.fecha}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={agregarDiaSinClase} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Fecha
              <input
                type="date"
                value={nuevaFecha}
                min={primerDia}
                max={ultimoDia}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Motivo
              <select
                value={nuevoMotivo}
                onChange={(e) => setNuevoMotivo(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
              >
                {MOTIVOS_PRESET.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {nuevoMotivo === "Otro" && (
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Detalle
                <input
                  value={nuevoMotivoOtro}
                  onChange={(e) => setNuevoMotivoOtro(e.target.value)}
                  placeholder="Ej: Acto escolar"
                  className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={guardandoDia}
              className="h-10 rounded-lg border border-border font-semibold text-sm px-4 disabled:opacity-60"
            >
              {guardandoDia ? "Guardando…" : "+ Agregar"}
            </button>
          </form>
          {mensajeDia && <div className="text-xs text-text-soft">{mensajeDia}</div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 overflow-x-auto print:overflow-visible print:border-0 print:p-0">
        <EncabezadoDocumento
          titulo="REGISTRO DE ASISTENCIA"
          datos={[
            { label: "Curso/Grado", value: curso?.grado ?? "" },
            { label: "Turno", value: curso ? etiquetaTurno[curso.turno] ?? curso.turno : "" },
            { label: "Énfasis", value: curso?.enfasis ?? "—" },
            { label: "Mes", value: nombreMes },
          ]}
        />

        <table className="border-collapse w-full" style={{ fontSize: "11px" }}>
          <thead>
            <tr>
              <th className="text-left py-1 pr-2 border-b border-border sticky left-0 bg-card whitespace-nowrap">
                Estudiante
              </th>
              {dias.map((d) => (
                <th key={d} className="text-center py-1 border-b border-border font-medium" style={{ width: "20px" }}>
                  {d}
                  {sinClaseMapa.has(d) && <span className="text-danger">*</span>}
                </th>
              ))}
              <th className="text-center py-1 px-1 border-b border-border font-semibold" style={{ fontSize: "9px" }}>A</th>
              <th className="text-center py-1 px-1 border-b border-border font-semibold" style={{ fontSize: "9px" }}>T</th>
              <th className="text-center py-1 px-1 border-b border-border font-semibold" style={{ fontSize: "9px" }}>%</th>
              <th className="text-left py-1 px-1 border-b border-border font-semibold" style={{ fontSize: "9px" }}>Situación</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e) => {
              const fila = mapa.get(e.id);
              let ausencias = 0;
              let tardanzas = 0;
              let presentesOTardanzas = 0;
              let registrados = 0;
              dias.forEach((d) => {
                if (sinClaseMapa.has(d)) return;
                const c = fila?.get(d);
                if (c === "A") ausencias += 1;
                if (c === "T") tardanzas += 1;
                if (!c) return;
                registrados += 1;
                if (c === "P" || c === "T") presentesOTardanzas += 1;
              });
              const pct = registrados > 0 ? (presentesOTardanzas / registrados) * 100 : null;
              const situacion = calcularSituacion(pct);
              return (
                <tr key={e.id}>
                  <td className="py-1 pr-2 border-b border-border whitespace-nowrap sticky left-0 bg-card">
                    {e.nombre_completo}
                  </td>
                  {dias.map((d) => (
                    <td key={d} className="text-center py-1 border-b border-border">
                      {sinClaseMapa.has(d) ? "" : fila?.get(d) ?? ""}
                    </td>
                  ))}
                  <td className="text-center py-1 px-1 border-b border-border font-semibold text-danger" style={{ fontSize: "9px" }}>{ausencias || ""}</td>
                  <td className="text-center py-1 px-1 border-b border-border font-semibold text-warning" style={{ fontSize: "9px" }}>{tardanzas || ""}</td>
                  <td className="text-center py-1 px-1 border-b border-border font-semibold" style={{ fontSize: "9px" }}>
                    {pct === null ? "—" : `${Math.round(pct)}%`}
                  </td>
                  <td className={`text-left py-1 px-1 border-b border-border whitespace-nowrap ${situacion.claseTexto}`} style={{ fontSize: "9px" }}>
                    {situacion.etiqueta}
                  </td>
                </tr>
              );
            })}
            {estudiantes.length === 0 && (
              <tr>
                <td className="py-3 text-text-soft" colSpan={dias.length + 5}>
                  Sin estudiantes activos en este curso.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {estudiantes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-1.5">
                Resumen mensual del curso
                {resumenCurso.consideradas < estudiantes.length && (
                  <span className="font-normal text-text-soft">
                    {" "}
                    ({resumenCurso.consideradas}/{estudiantes.length} estudiantes con días registrados)
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 text-xs">
                {Object.entries(resumenCurso.conteo).map(([etiqueta, cantidad]) => {
                  const pctCurso =
                    resumenCurso.consideradas > 0 ? Math.round((cantidad / resumenCurso.consideradas) * 100) : 0;
                  const { claseTexto } = calcularSituacion(
                    etiqueta === "Plena"
                      ? 100
                      : etiqueta === "Regular"
                        ? 85
                        : etiqueta === "Irregular"
                          ? 70
                          : etiqueta === "Reiterada"
                            ? 55
                            : 0
                  );
                  return (
                    <span key={etiqueta} className={claseTexto}>
                      {ETIQUETA_LARGA[etiqueta]}: {cantidad} ({pctCurso}%)
                    </span>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1.5">Observaciones del mes</div>
              {diasSinClase.length === 0 ? (
                <div className="text-xs text-text-soft">Sin observaciones este mes.</div>
              ) : (
                <div className="flex flex-col gap-0.5 text-xs">
                  {diasSinClase.map((d) => (
                    <span key={d.id}>
                      <span className="text-danger font-semibold">*</span> Día {Number(d.fecha.slice(8, 10))}: {d.motivo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
