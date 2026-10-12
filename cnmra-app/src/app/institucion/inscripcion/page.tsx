"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type InscripcionFila = {
  id: string;
  estado: string;
  creado_en: string;
  estudiantes: { nombre_completo: string } | null;
  cursos: { grado: string; turno: string } | null;
};

export default function InscripcionInstitucional() {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [pendientes, setPendientes] = useState<InscripcionFila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [tutorCedula, setTutorCedula] = useState("");
  const [tutorNombre, setTutorNombre] = useState("");
  const [tutorParentesco, setTutorParentesco] = useState("");
  const [tutorTelefono, setTutorTelefono] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [tutorDireccion, setTutorDireccion] = useState("");
  const [estudianteNombre, setEstudianteNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [cursoId, setCursoId] = useState("");

  const cargar = useCallback(async () => {
    const { data: cursosData } = await supabase.from("cursos").select("id, grado, turno, ciclo, enfasis").order("orden");
    setCursos(cursosData ?? []);

    const { data: inscripcionesData } = await supabase
      .from("inscripciones")
      .select("id, estado, creado_en, estudiantes(nombre_completo), cursos(grado, turno)")
      .order("creado_en", { ascending: false })
      .limit(15);
    setPendientes((inscripcionesData as unknown as InscripcionFila[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);

    // 1) Buscar si ya existe una familia con esa cédula de tutor (para vincular hermanos)
    const { data: familiaExistente } = await supabase
      .from("familias")
      .select("id")
      .eq("tutor_cedula", tutorCedula)
      .maybeSingle();

    let familiaId = familiaExistente?.id as string | undefined;

    if (!familiaId) {
      const { data: nuevaFamilia, error: errorFamilia } = await supabase
        .from("familias")
        .insert({
          tutor_nombre: tutorNombre,
          tutor_cedula: tutorCedula,
          tutor_parentesco: tutorParentesco,
          tutor_telefono: tutorTelefono,
          tutor_email: tutorEmail,
          tutor_direccion: tutorDireccion,
        })
        .select("id")
        .single();

      if (errorFamilia || !nuevaFamilia) {
        setMensaje("No se pudo crear la familia: " + errorFamilia?.message);
        setGuardando(false);
        return;
      }
      familiaId = nuevaFamilia.id;
    }

    const { data: estudiante, error: errorEstudiante } = await supabase
      .from("estudiantes")
      .insert({
        familia_id: familiaId,
        nombre_completo: estudianteNombre,
        fecha_nacimiento: fechaNacimiento || null,
      })
      .select("id")
      .single();

    if (errorEstudiante || !estudiante) {
      setMensaje("No se pudo crear el estudiante: " + errorEstudiante?.message);
      setGuardando(false);
      return;
    }

    const { error: errorInscripcion } = await supabase.from("inscripciones").insert({
      estudiante_id: estudiante.id,
      curso_solicitado_id: cursoId || null,
      estado: "pendiente",
    });

    if (errorInscripcion) {
      setMensaje("No se pudo registrar la inscripción: " + errorInscripcion.message);
      setGuardando(false);
      return;
    }

    setMensaje(
      familiaExistente
        ? "Inscripción cargada y vinculada a la familia ya existente."
        : "Inscripción cargada con una familia nueva."
    );
    setEstudianteNombre("");
    setFechaNacimiento("");
    setCursoId("");
    setGuardando(false);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Inscripción</h1>
        <p className="text-sm text-text-soft mt-1">
          Si la cédula del tutor ya existe, el estudiante se vincula automáticamente
          a esa familia (para hermanos).
        </p>
      </div>

      <form onSubmit={guardar} className="bg-card border border-border rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <Campo label="Cédula del tutor" value={tutorCedula} onChange={setTutorCedula} required />
        <Campo label="Nombre completo del tutor" value={tutorNombre} onChange={setTutorNombre} required />
        <Campo label="Parentesco" value={tutorParentesco} onChange={setTutorParentesco} />
        <Campo label="Teléfono" value={tutorTelefono} onChange={setTutorTelefono} />
        <Campo label="Correo electrónico" value={tutorEmail} onChange={setTutorEmail} type="email" />
        <Campo label="Dirección" value={tutorDireccion} onChange={setTutorDireccion} />

        <div className="md:col-span-2 border-t border-border pt-4 mt-1 text-[12.5px] font-semibold text-text-soft">
          DATOS DEL ESTUDIANTE
        </div>
        <Campo label="Nombre completo del estudiante" value={estudianteNombre} onChange={setEstudianteNombre} required />
        <Campo label="Fecha de nacimiento" value={fechaNacimiento} onChange={setFechaNacimiento} type="date" />

        <label className="flex flex-col gap-1.5 text-[13px] font-medium md:col-span-2">
          Curso al que postula
          <select
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
          >
            <option value="">Seleccionar curso…</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grado} {c.enfasis ? `— ${c.enfasis}` : ""} — Turno {c.turno}
              </option>
            ))}
          </select>
        </label>

        {mensaje && <div className="md:col-span-2 text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}

        <button
          type="submit"
          disabled={guardando}
          className="md:col-span-2 h-11 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Registrar inscripción"}
        </button>
      </form>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-lg mb-3">Últimas inscripciones</h3>
        <div className="flex flex-col">
          {pendientes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-border last:border-none text-sm">
              <span>
                {p.estudiantes?.nombre_completo ?? "—"} — {p.cursos ? `${p.cursos.grado} (${p.cursos.turno})` : "sin curso"}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  p.estado === "aprobada"
                    ? "bg-[#E7F3EB] text-success"
                    : p.estado === "rechazada"
                    ? "bg-[#FBEAE8] text-danger"
                    : "bg-[#FBEFE6] text-warning"
                }`}
              >
                {p.estado}
              </span>
            </div>
          ))}
          {pendientes.length === 0 && <p className="text-sm text-text-soft">Todavía no hay inscripciones cargadas.</p>}
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-border px-3 text-sm bg-card focus:outline-none focus:border-teal"
      />
    </label>
  );
}
