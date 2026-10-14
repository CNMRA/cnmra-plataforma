"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };
type AsistenciaFila = { estudiante_id: string; fecha: string; estado: string };

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

function mesActualISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReporteAsistenciaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [mes, setMes] = useState(mesActualISO());
  const [filas, setFilas] = useState<AsistenciaFila[]>([]);
  const [cargando, setCargando] = useState(true);

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

  const mapa = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    filas.forEach((f) => {
      const dia = Number(f.fecha.slice(8, 10));
      if (!m.has(f.estudiante_id)) m.set(f.estudiante_id, new Map());
      m.get(f.estudiante_id)!.set(dia, CODIGO[f.estado] ?? "?");
    });
    return m;
  }, [filas]);

  const dias = Array.from({ length: diasDelMes }, (_, i) => i + 1);
  const nombreMes = new Date(anio, mesNum - 1, 1).toLocaleDateString("es-PY", { month: "long", year: "numeric" });

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
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
      </div>

      <div className="bg-card border border-border rounded-xl p-5 overflow-x-auto">
        <EncabezadoDocumento
          titulo="REGISTRO DE ASISTENCIA"
          datos={[
            { label: "Curso/Grado", value: curso?.grado ?? "" },
            { label: "Turno", value: curso ? etiquetaTurno[curso.turno] ?? curso.turno : "" },
            { label: "Énfasis", value: curso?.enfasis ?? "—" },
            { label: "Mes", value: nombreMes },
          ]}
        />

        <div className="mb-3">
          <div className="text-xs text-text-soft">P = Presente · A = Ausente · T = Tardanza · J = Justificado</div>
        </div>

        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left py-1.5 pr-3 border-b border-border sticky left-0 bg-card">Estudiante</th>
              {dias.map((d) => (
                <th key={d} className="text-center py-1.5 px-1 border-b border-border font-medium">
                  {d}
                </th>
              ))}
              <th className="text-center py-1.5 px-2 border-b border-border font-semibold">Ausencias</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-semibold">Tardanzas</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e) => {
              const fila = mapa.get(e.id);
              let ausencias = 0;
              let tardanzas = 0;
              dias.forEach((d) => {
                const c = fila?.get(d);
                if (c === "A") ausencias += 1;
                if (c === "T") tardanzas += 1;
              });
              return (
                <tr key={e.id}>
                  <td className="py-1.5 pr-3 border-b border-border whitespace-nowrap sticky left-0 bg-card">{e.nombre_completo}</td>
                  {dias.map((d) => (
                    <td key={d} className="text-center py-1.5 px-1 border-b border-border">
                      {fila?.get(d) ?? ""}
                    </td>
                  ))}
                  <td className="text-center py-1.5 px-2 border-b border-border font-semibold text-danger">{ausencias || ""}</td>
                  <td className="text-center py-1.5 px-2 border-b border-border font-semibold text-warning">{tardanzas || ""}</td>
                </tr>
              );
            })}
            {estudiantes.length === 0 && (
              <tr>
                <td className="py-3 text-text-soft" colSpan={dias.length + 3}>
                  Sin estudiantes activos en este curso.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
