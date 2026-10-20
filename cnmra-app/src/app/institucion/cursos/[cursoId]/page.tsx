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
type Seccion = { id: string; nombre: string };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null };
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
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>("asistencia");
  const [toast, setToast] = useState<string | null>(null);

  // Muestra un cartel de confirmación bien visible arriba de la pantalla,
  // que desaparece solo a los pocos segundos.
  function mostrarToast(mensaje: string) {
    setToast(mensaje);
    setTimeout(() => setToast(null), 3000);
  }

  const cargarCurso = useCallback(async () => {
    const { data: cursoData } = await supabase
      .from("cursos")
      .select("id, grado, turno, ciclo, enfasis")
      .eq("id", cursoId)
      .single();
    setCurso(cursoData ?? null);

    const { data: seccionesData } = await supabase.from("secciones").select("id, nombre").eq("curso_id", cursoId);
    setSecciones(seccionesData ?? []);
    const seccionIds = (seccionesData ?? []).map((s) => s.id);

    const { data: estudiantesData } = seccionIds.length
      ? await supabase
          .from("estudiantes")
          .select("id, nombre_completo, cedula")
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

  async function agregarEstudiante(datos: { nombre: string; cedula: string | null; fechaNacimiento: string; seccionId: string }) {
    await supabase.from("estudiantes").insert({
      nombre_completo: datos.nombre,
      cedula: datos.cedula,
      fecha_nacimiento: datos.fechaNacimiento || null,
      seccion_id: datos.seccionId,
      familia_id: null,
      estado: "activo",
    });
    await cargarCurso();
  }

  async function actualizarEstudiante(estudianteId: string, nombre: string, cedula: string) {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return;
    await supabase
      .from("estudiantes")
      .update({ nombre_completo: nombreLimpio, cedula: cedula.trim() || null })
      .eq("id", estudianteId);
    await cargarCurso();
  }

  async function eliminarEstudiante(estudianteId: string, nombre: string) {
    const confirmado = window.confirm(
      `¿Eliminar a ${nombre} de este curso?\n\nEsta acción no se puede deshacer: se borran también su asistencia, registro anecdótico y calificaciones.`
    );
    if (!confirmado) return;
    await supabase.from("estudiantes").delete().eq("id", estudianteId);
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
      <Toast mensaje={toast} />

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

      <PanelAgregarEstudiante secciones={secciones} onAgregar={agregarEstudiante} />

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
          <PanelAsistencia
            estudiantes={estudiantes}
            supabase={supabase}
            onActualizarEstudiante={actualizarEstudiante}
            onEliminarEstudiante={eliminarEstudiante}
            onGuardado={mostrarToast}
          />
        </div>
      )}

      {estudiantes.length > 0 && tab === "anecdotico" && (
        <PanelAnecdotico
          estudiantes={estudiantes}
          disciplinas={disciplinas}
          onAgregarMateria={agregarMateria}
          onActualizarEstudiante={actualizarEstudiante}
          onEliminarEstudiante={eliminarEstudiante}
          supabase={supabase}
          cursoId={cursoId}
          onGuardado={mostrarToast}
        />
      )}

      {estudiantes.length > 0 && tab === "calificaciones" && (
        <PanelCalificaciones
          estudiantes={estudiantes}
          disciplinas={disciplinas}
          grado={curso.grado}
          onAgregarMateria={agregarMateria}
          onActualizarEstudiante={actualizarEstudiante}
          onEliminarEstudiante={eliminarEstudiante}
          supabase={supabase}
          cursoId={cursoId}
        />
      )}
    </div>
  );
}

// Cartel de confirmación fijo arriba de la pantalla, visible sin importar
// en qué pestaña (Asistencia/Anecdótico/Calificaciones) esté la persona.
function Toast({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-success text-white rounded-lg px-5 py-3 shadow-lg text-sm font-semibold flex items-center gap-2 max-w-[90vw] text-center">
      ✓ {mensaje}
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

// Carga directa de un estudiante desde Dirección / Carga de datos, sin necesidad de que la familia
// ya tenga cuenta. Queda sin familia_id hasta que alguien lo vincule más adelante.
function PanelAgregarEstudiante({
  secciones,
  onAgregar,
}: {
  secciones: Seccion[];
  onAgregar: (datos: { nombre: string; cedula: string | null; fechaNacimiento: string; seccionId: string }) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sinCedula, setSinCedula] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!sinCedula && !cedula.trim()) {
      setMensaje('Ingresá la cédula, o marcá "No tiene cédula todavía".');
      return;
    }
    if (!seccionId) {
      setMensaje("Seleccioná una sección.");
      return;
    }
    setGuardando(true);
    setMensaje(null);
    await onAgregar({
      nombre: nombre.trim(),
      cedula: sinCedula ? null : cedula.trim(),
      fechaNacimiento,
      seccionId,
    });
    setNombre("");
    setCedula("");
    setSinCedula(false);
    setFechaNacimiento("");
    setSeccionId("");
    setGuardando(false);
    setMensaje("Estudiante cargado. Cuando la familia se registre con la misma cédula, se podrá vincular a su cuenta.");
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-xs text-teal font-medium self-start">
        + Agregar estudiante directamente
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Agregar estudiante</span>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-text-soft">
          Cancelar
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Nombre y apellido
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Cédula
          <input
            required={!sinCedula}
            disabled={sinCedula}
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            className="h-10 rounded-lg border border-border px-3 text-sm bg-card disabled:opacity-50"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-text-soft">
          <input
            type="checkbox"
            checked={sinCedula}
            onChange={(e) => {
              setSinCedula(e.target.checked);
              if (e.target.checked) setCedula("");
            }}
          />
          No tiene cédula todavía
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Fecha de nacimiento
        <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Sección
        <select required value={seccionId} onChange={(e) => setSeccionId(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card">
          <option value="">Seleccionar…</option>
          {secciones.map((s) => (
            <option key={s.id} value={s.id}>
              Sección {s.nombre}
            </option>
          ))}
        </select>
      </label>

      {secciones.length === 0 && (
        <p className="text-xs text-warning">Este curso todavía no tiene ninguna sección cargada.</p>
      )}

      {mensaje && <p className="text-sm text-text-soft">{mensaje}</p>}

      <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-5">
        {guardando ? "Guardando…" : "Agregar estudiante"}
      </button>
    </form>
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

// Formulario inline para editar nombre y cédula de un estudiante. Se usa tanto en la fila
// desplegable (Anecdótico/Calificaciones) como en la lista plana de Asistencia.
function FormularioEditarEstudiante({
  estudiante,
  onGuardar,
  onCancelar,
}: {
  estudiante: Estudiante;
  onGuardar: (nombre: string, cedula: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] =
