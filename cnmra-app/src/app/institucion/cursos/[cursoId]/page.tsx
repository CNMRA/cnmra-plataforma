"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  calcularOrdinaria,
  evaluarMateria,
  tieneRegularizacion,
  aprueba,
} from "@/lib/calificaciones";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };
type Disciplina = { id: string; nombre: string; orden: number };
type Registro = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};
type CalifRow = { id: string; disciplina_id: string; instancia: Instancia; nota: number | null };

type Tab = "asistencia" | "anecdotico" | "calificaciones";
type Supa = ReturnType<typeof createClient>;

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

export default function CursoDetallePage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>("asistencia");

  const cargarCurso = useCallback(async () => {
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

    const { data: disciplinasData } = await supabase
      .from("disciplinas")
      .select("id, nombre, orden")
      .eq("curso_id", cursoId)
      .order("orden");
    setDisciplinas(disciplinasData ?? []);
    setCargando(false);
  }, [cursoId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargarCurso();
  }, [cargarCurso]);

  async function agregarMateria(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) return;
    await supabase.from("disciplinas").insert({ curso_id: cursoId, nombre: limpio });
    await cargarCurso();
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (!curso) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        No se encontró este curso.{" "}
        <Link href="/institucion/cursos" className="text-teal font-medium">
          Volver a Cursos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/institucion/cursos" className="text-xs text-teal font-medium">
          ← Volver a Cursos
        </Link>
        <h1 className="font-display text-2xl mt-1">
          {curso.grado}
          {curso.enfasis ? ` — Énfasis en ${curso.enfasis}` : ""}
        </h1>
        <p className="text-sm text-text-soft mt-1">
          {etiquetaTurno[curso.turno] ?? curso.turno} · {curso.ciclo}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <TabButton activo={tab === "asistencia"} onClick={() => setTab("asistencia")}>
          Asistencia
        </TabButton>
        <TabButton activo={tab === "anecdotico"} onClick={() => setTab("anecdotico")}>
          Registro Anecdótico
        </TabButton>
        <TabButton activo={tab === "calificaciones"} onClick={() => setTab("calificaciones")}>
          Calificaciones
        </TabButton>
      </div>

      {estudiantes.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Todavía no hay estudiantes activos cargados en este curso.
        </div>
      )}

      {estudiantes.length > 0 && tab === "asistencia" && (
        <div className="flex flex-col gap-3">
          <Link
            href={`/institucion/cursos/${cursoId}/reporte-asistencia`}
            className="text-xs text-teal font-medium self-end"
          >
            Ver reporte del mes para imprimir/descargar →
          </Link>
          <PanelAsistencia estudiantes={estudiantes} supabase={supabase} />
        </div>
      )}

      {estudiantes.length > 0 && tab === "anecdotico" && (
        <PanelAnecdotico estudiantes={estudiantes} disciplinas={disciplinas} onAgregarMateria={agregarMateria} supabase={supabase} />
      )}

      {estudiantes.length > 0 && tab === "calificaciones" && (
        <PanelCalificaciones
          estudiantes={estudiantes}
          disciplinas={disciplinas}
          grado={curso.grado}
          onAgregarMateria={agregarMateria}
          supabase={supabase}
        />
      )}
    </div>
  );
}

function TabButton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-[13px] font-semibold ${
        activo ? "bg-navy text-white" : "bg-card border border-border text-text-soft"
      }`}
    >
      {children}
    </button>
  );
}

// Chip "+ Materia" reutilizable: agrega una materia nueva al curso sin salir de la pantalla.
function ChipAgregarMateria({ onAgregarMateria }: { onAgregarMateria: (nombre: string) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    await onAgregarMateria(nombre.trim());
    setNombre("");
    setGuardando(false);
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-border text-text-soft"
      >
        + Materia
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre…"
        className="h-8 w-32 rounded-full border border-border px-3 text-xs bg-card"
      />
      <button
        type="button"
        disabled={guardando}
        onClick={confirmar}
        className="h-8 px-3 rounded-full bg-navy text-white text-xs font-semibold disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}

function ChipMateria({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
        activo ? "bg-navy text-white border-navy" : "bg-card border-border text-text-soft"
      }`}
    >
      {children}
    </button>
  );
}

// Fila de estudiante desplegable, reutilizada por Registro Anecdótico y Calificaciones.
function FilaEstudiante({
  nombre,
  abierto,
  onToggle,
  children,
}: {
  nombre: string;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-none">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-3 text-sm font-medium text-left">
        {nombre}
        <span className="text-text-soft text-xs">{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && <div className="pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

// ========== ASISTENCIA (general por curso, por día) ==========
function PanelAsistencia({ estudiantes, supabase }: { estudiantes: Estudiante[]; supabase: Supa }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("asistencias")
      .select("estudiante_id, estado")
      .eq("fecha", fecha)
      .in("estudiante_id", estudiantes.map((e) => e.id));
    const mapa: Record<string, string> = {};
    estudiantes.forEach((e) => {
      mapa[e.id] = "presente";
    });
    (data ?? []).forEach((a) => {
      mapa[a.estudiante_id] = a.estado;
    });
    setEstados(mapa);
  }, [fecha, estudiantes, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const filas = estudiantes.map((e) => ({ estudiante_id: e.id, fecha, estado: estados[e.id] ?? "presente" }));
    await supabase.from("asistencias").upsert(filas, { onConflict: "estudiante_id,fecha" });
    setGuardando(false);
    setMensaje("Asistencia guardada. Las familias con ausencia o llegada tardía reciben la notificación automáticamente.");
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium max-w-xs">
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
      </label>

      <div className="flex flex-col border-t border-border pt-3">
        {estudiantes.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-none">
            <span className="text-sm">{e.nombre_completo}</span>
            <select
              value={estados[e.id] ?? "presente"}
              onChange={(ev) => setEstados((prev) => ({ ...prev, [e.id]: ev.target.value }))}
              className="h-9 rounded-md border border-border px-2.5 text-sm bg-card"
            >
              <option value="presente">Presente</option>
              <option value="ausente">Ausente</option>
              <option value="tardanza">Tardanza</option>
              <option value="justificado">Justificado</option>
            </select>
          </div>
        ))}
      </div>

      <button onClick={guardar} disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-full sm:w-fit px-6">
        {guardando ? "Guardando…" : "Guardar asistencia del día"}
      </button>
      {mensaje && <p className="text-sm text-success">{mensaje}</p>}
