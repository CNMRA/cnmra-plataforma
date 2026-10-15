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
  const [nombre, setNombre] = useState(estudiante.nombre_completo);
  const [cedula, setCedula] = useState(estudiante.cedula ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    await onGuardar(nombre, cedula);
    setGuardando(false);
  }

  return (
    <div className="flex flex-col gap-2 bg-bg rounded-lg p-3 my-1">
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Nombre y apellido
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Cédula
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Sin cédula"
          className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
        />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={guardando} onClick={guardar} className="h-9 px-4 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className="h-9 px-4 rounded-lg border border-border text-xs font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Fila de estudiante desplegable, reutilizada por Registro Anecdótico y Calificaciones.
// Incluye los íconos de editar (✏️) y eliminar (🗑️).
function FilaEstudiante({
  estudiante,
  abierto,
  onToggle,
  onActualizar,
  onEliminar,
  children,
}: {
  estudiante: Estudiante;
  abierto: boolean;
  onToggle: () => void;
  onActualizar: (estudianteId: string, nombre: string, cedula: string) => Promise<void>;
  onEliminar: (estudianteId: string, nombre: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="border-b border-border last:border-none">
        <FormularioEditarEstudiante
          estudiante={estudiante}
          onCancelar={() => setEditando(false)}
          onGuardar={async (nombre, cedula) => {
            await onActualizar(estudiante.id, nombre, cedula);
            setEditando(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="border-b border-border last:border-none">
      <div className="flex items-center justify-between gap-1 py-1">
        <button type="button" onClick={onToggle} className="flex-1 flex items-center justify-between py-2 text-sm font-medium text-left">
          {estudiante.nombre_completo}
          <span className="text-text-soft text-xs">{abierto ? "▲" : "▼"}</span>
        </button>
        <button type="button" onClick={() => setEditando(true)} title="Editar nombre o cédula" className="text-base px-1.5 py-1 shrink-0">
          ✏️
        </button>
        <button
          type="button"
          onClick={() => onEliminar(estudiante.id, estudiante.nombre_completo)}
          title="Eliminar estudiante"
          className="text-base px-1.5 py-1 shrink-0"
        >
          🗑️
        </button>
      </div>
      {abierto && <div className="pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

// ========== ASISTENCIA (general por curso, por día) ==========
function PanelAsistencia({
  estudiantes,
  supabase,
  onActualizarEstudiante,
  onEliminarEstudiante,
}: {
  estudiantes: Estudiante[];
  supabase: Supa;
  onActualizarEstudiante: (estudianteId: string, nombre: string, cedula: string) => Promise<void>;
  onEliminarEstudiante: (estudianteId: string, nombre: string) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

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
        {estudiantes.map((e) =>
          editandoId === e.id ? (
            <FormularioEditarEstudiante
              key={e.id}
              estudiante={e}
              onCancelar={() => setEditandoId(null)}
              onGuardar={async (nombre, cedula) => {
                await onActualizarEstudiante(e.id, nombre, cedula);
                setEditandoId(null);
              }}
            />
          ) : (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-none">
              <span className="text-sm flex-1">{e.nombre_completo}</span>
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
              <button type="button" onClick={() => setEditandoId(e.id)} title="Editar nombre o cédula" className="text-base px-1 shrink-0">
                ✏️
              </button>
              <button
                type="button"
                onClick={() => onEliminarEstudiante(e.id, e.nombre_completo)}
                title="Eliminar estudiante"
                className="text-base px-1 shrink-0"
              >
                🗑️
              </button>
            </div>
          )
        )}
      </div>

      <button onClick={guardar} disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-full sm:w-fit px-6">
        {guardando ? "Guardando…" : "Guardar asistencia del día"}
      </button>
      {mensaje && <p className="text-sm text-success">{mensaje}</p>}
    </div>
  );
}

// ========== REGISTRO ANECDÓTICO (lista de estudiantes → materia → cargar) ==========
function PanelAnecdotico({
  estudiantes,
  disciplinas,
  onAgregarMateria,
  onActualizarEstudiante,
  onEliminarEstudiante,
  supabase,
  cursoId,
}: {
  estudiantes: Estudiante[];
  disciplinas: Disciplina[];
  onAgregarMateria: (nombre: string) => Promise<void>;
  onActualizarEstudiante: (estudianteId: string, nombre: string, cedula: string) => Promise<void>;
  onEliminarEstudiante: (estudianteId: string, nombre: string) => Promise<void>;
  supabase: Supa;
  cursoId: string;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      {estudiantes.map((e) => (
        <FilaEstudiante
          key={e.id}
          estudiante={e}
          abierto={abiertoId === e.id}
          onToggle={() => setAbiertoId(abiertoId === e.id ? null : e.id)}
          onActualizar={onActualizarEstudiante}
          onEliminar={onEliminarEstudiante}
        >
          <FilaAnecdotico
            estudianteId={e.id}
            disciplinas={disciplinas}
            onAgregarMateria={onAgregarMateria}
            supabase={supabase}
            cursoId={cursoId}
          />
        </FilaEstudiante>
      ))}
    </div>
  );
}

function FilaAnecdotico({
  estudianteId,
  disciplinas,
  onAgregarMateria,
  supabase,
  cursoId,
}: {
  estudianteId: string;
  disciplinas: Disciplina[];
  onAgregarMateria: (nombre: string) => Promise<void>;
  supabase: Supa;
  cursoId: string;
}) {
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("atencion");
  const [descripcion, setDescripcion] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("registros_anecdoticos")
      .select("id, fecha, categoria, descripcion, disciplina_id, disciplinas(nombre)")
      .eq("estudiante_id", estudianteId)
      .order("fecha", { ascending: false });
    setRegistros((data as unknown as Registro[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (materiaId === null || !descripcion) return;
    setGuardando(true);
    await supabase.from("registros_anecdoticos").insert({
      estudiante_id: estudianteId,
      categoria,
      descripcion,
      disciplina_id: materiaId || null,
    });
    setDescripcion("");
    setGuardando(false);
    cargar();
  }

  return (
    <>
      <Link
        href={`/institucion/cursos/${cursoId}/anecdotico/${estudianteId}`}
        className="text-xs text-teal font-medium self-end"
      >
        Ver informe para imprimir →
      </Link>

      <div className="flex flex-wrap gap-2">
        <ChipMateria activo={materiaId === ""} onClick={() => setMateriaId("")}>
          General
        </ChipMateria>
        {disciplinas.map((d) => (
          <ChipMateria key={d.id} activo={materiaId === d.id} onClick={() => setMateriaId(d.id)}>
            {d.nombre}
          </ChipMateria>
        ))}
        <ChipAgregarMateria onAgregarMateria={onAgregarMateria} />
      </div>

      {materiaId !== null && (
        <form onSubmit={agregar} className="flex flex-col gap-3 bg-bg rounded-lg p-3">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card sm:w-fit"
          >
            <option value="positivo">Positivo</option>
            <option value="atencion">A tener en cuenta</option>
            <option value="conducta">Conducta</option>
          </select>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción del registro…"
            className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-20 w-full"
            required
          />
          <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm w-full sm:w-fit px-5">
            {guardando ? "Guardando…" : "Cargar registro"}
          </button>
        </form>
      )}

      <div className="flex flex-col border-t border-border pt-2">
        {registros.map((r) => (
          <div key={r.id} className="py-2 border-b border-border last:border-none text-sm">
            <div className="text-xs text-text-soft">
              {r.fecha} · {r.categoria}
              {r.disciplinas?.nombre ? ` · ${r.disciplinas.nombre}` : ""}
            </div>
            <div>{r.descripcion}</div>
          </div>
        ))}
        {registros.length === 0 && <p className="text-sm text-text-soft">Sin registros todavía.</p>}
      </div>
    </>
  );
}

// ========== CALIFICACIONES (lista de estudiantes → materia → cargar notas) ==========
function PanelCalificaciones({
  estudiantes,
  disciplinas,
  grado,
  onAgregarMateria,
  onActualizarEstudiante,
  onEliminarEstudiante,
  supabase,
  cursoId,
}: {
  estudiantes: Estudiante[];
  disciplinas: Disciplina[];
  grado: string;
  onAgregarMateria: (nombre: string) => Promise<void>;
  onActualizarEstudiante: (estudianteId: string, nombre: string, cedula: string) => Promise<void>;
  onEliminarEstudiante: (estudianteId: string, nombre: string) => Promise<void>;
  supabase: Supa;
  cursoId: string;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      {estudiantes.map((e) => (
        <FilaEstudiante
          key={e.id}
          estudiante={e}
          abierto={abiertoId === e.id}
          onToggle={() => setAbiertoId(abiertoId === e.id ? null : e.id)}
          onActualizar={onActualizarEstudiante}
          onEliminar={onEliminarEstudiante}
        >
          <FilaCalificaciones
            estudianteId={e.id}
            disciplinas={disciplinas}
            grado={grado}
            onAgregarMateria={onAgregarMateria}
            supabase={supabase}
            cursoId={cursoId}
          />
        </FilaEstudiante>
      ))}
    </div>
  );
}

function FilaCalificaciones({
  estudianteId,
  disciplinas,
  grado,
  onAgregarMateria,
  supabase,
  cursoId,
}: {
  estudianteId: string;
  disciplinas: Disciplina[];
  grado: string;
  onAgregarMateria: (nombre: string) => Promise<void>;
  supabase: Supa;
  cursoId: string;
}) {
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [califs, setCalifs] = useState<CalifRow[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [etapa1, setEtapa1] = useState("");
  const [etapa2, setEtapa2] = useState("");
  const [complementario, setComplementario] = useState("");
  const [regularizacion, setRegularizacion] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("calificaciones").select("id, disciplina_id, instancia, nota").eq("estudiante_id", estudianteId);
    setCalifs((data as unknown as CalifRow[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  const notasPorDisciplina = useMemo(() => {
    const mapa = new Map<string, NotasPorInstancia>();
    califs.forEach((c) => {
      if (c.nota === null) return;
      const actual = mapa.get(c.disciplina_id) ?? {};
      actual[c.instancia] = c.nota;
      mapa.set(c.disciplina_id, actual);
    });
    return mapa;
  }, [califs]);

  const notas = useMemo(() => notasPorDisciplina.get(materiaId ?? "") ?? {}, [notasPorDisciplina, materiaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precargar los campos con lo ya guardado al cambiar de materia
    setEtapa1(notas.etapa1?.toString() ?? "");
    setEtapa2(notas.etapa2?.toString() ?? "");
    setComplementario(notas.complementario?.toString() ?? "");
    setRegularizacion(notas.regularizacion?.toString() ?? "");
  }, [notas]);

  const resultado = evaluarMateria(notas, grado);

  async function guardarEtapas(e: React.FormEvent) {
    e.preventDefault();
    if (!materiaId) return;
    const e1 = etapa1 ? Number(etapa1) : null;
    const e2 = etapa2 ? Number(etapa2) : null;
    if (e1 === null && e2 === null) return;

    setGuardando(true);
    const filas: { estudiante_id: string; disciplina_id: string; instancia: Instancia; nota: number }[] = [];
    if (e1 !== null) filas.push({ estudiante_id: estudianteId, disciplina_id: materiaId, instancia: "etapa1", nota: e1 });
    if (e2 !== null) filas.push({ estudiante_id: estudianteId, disciplina_id: materiaId, instancia: "etapa2", nota: e2 });
    if (e1 !== null && e2 !== null) {
      filas.push({ estudiante_id: estudianteId, disciplina_id: materiaId, instancia: "ordinaria", nota: calcularOrdinaria(e1, e2) });
    }
    await supabase.from("calificaciones").upsert(filas, { onConflict: "estudiante_id,disciplina_id,instancia" });
    setGuardando(false);
    cargar();
  }

  async function guardarInstanciaUnica(instancia: "complementario" | "regularizacion", valor: string) {
    if (!materiaId || !valor) return;
    setGuardando(true);
    await supabase
      .from("calificaciones")
      .upsert({ estudiante_id: estudianteId, disciplina_id: materiaId, instancia, nota: Number(valor) }, { onConflict: "estudiante_id,disciplina_id,instancia" });
    setGuardando(false);
    cargar();
  }

  return (
    <>
      <Link
        href={`/institucion/cursos/${cursoId}/calificaciones/${estudianteId}`}
        className="text-xs text-teal font-medium self-end"
      >
        Ver libreta para imprimir →
      </Link>

      <div className="flex flex-wrap gap-2">
        {disciplinas.map((d) => (
          <ChipMateria key={d.id} activo={materiaId === d.id} onClick={() => setMateriaId(d.id)}>
            {d.nombre}
          </ChipMateria>
        ))}
        <ChipAgregarMateria onAgregarMateria={onAgregarMateria} />
      </div>

      {materiaId && (
        <div className="flex flex-col gap-4 bg-bg rounded-lg p-3">
          <form onSubmit={guardarEtapas} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
              Etapa 1
              <input type="number" min={1} max={5} step={1} value={etapa1} onChange={(e) => setEtapa1(e.target.value)} className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
              Etapa 2
              <input type="number" min={1} max={5} step={1} value={etapa2} onChange={(e) => setEtapa2(e.target.value)} className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto">
              {guardando ? "Guardando…" : "Guardar etapas"}
            </button>
          </form>

          {notas.ordinaria !== undefined && (
            <div className="text-sm">
              Ordinaria: <span className="font-semibold">{notas.ordinaria}</span>{" "}
              <span className={aprueba(notas.ordinaria) ? "text-success" : "text-danger"}>
                {aprueba(notas.ordinaria) ? "— Aprobada" : "— No aprobada"}
              </span>
            </div>
          )}

          {notas.ordinaria !== undefined && !aprueba(notas.ordinaria) && (
            <div className="bg-card rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                Complementario
                <input type="number" min={1} max={5} step={1} value={complementario} onChange={(e) => setComplementario(e.target.value)} className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <button type="button" disabled={guardando} onClick={() => guardarInstanciaUnica("complementario", complementario)} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto">
                Guardar complementario
              </button>
            </div>
          )}

          {notas.complementario !== undefined && !aprueba(notas.complementario) && tieneRegularizacion(grado) && (
            <div className="bg-card rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                Regularización
                <input type="number" min={1} max={5} step={1} value={regularizacion} onChange={(e) => setRegularizacion(e.target.value)} className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <button type="button" disabled={guardando} onClick={() => guardarInstanciaUnica("regularizacion", regularizacion)} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto">
                Guardar regularización
              </button>
            </div>
          )}

          {resultado && (
            <div className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${resultado.aprobado ? "bg-[#E7F3EB] text-success" : "bg-[#FBEAE8] text-danger"}`}>
              Nota final ({ETIQUETA_INSTANCIA[resultado.instanciaFinal]}): {resultado.notaFinal} — {resultado.aprobado ? "Aprobada" : "No aprobada — repite esta materia"}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col border-t border-border pt-2">
        {disciplinas.map((d) => {
          const n = notasPorDisciplina.get(d.id) ?? {};
          const r = evaluarMateria(n, grado);
          return (
            <div key={d.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
              <span>{d.nombre}</span>
              <span className={r === null ? "text-text-soft" : r.aprobado ? "text-success font-semibold" : "text-danger font-semibold"}>
                {r ? `${r.notaFinal} (${ETIQUETA_INSTANCIA[r.instanciaFinal]})` : "Sin notas"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
