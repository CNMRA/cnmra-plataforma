"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };

export default function InscripcionFamilia() {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sinCedula, setSinCedula] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("cursos").select("id, grado, turno, enfasis").order("orden").then(({ data }) => setCursos(data ?? []));
  }, [supabase]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!sinCedula && !cedula.trim()) {
      setMensaje("Ingresá el número de cédula, o marcá \"No tiene cédula todavía\".");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let { data: familia } = await supabase.from("familias").select("id").eq("tutor_perfil_id", user.id).maybeSingle();

    if (!familia) {
      const { data: perfil } = await supabase.from("perfiles").select("nombre_completo").eq("id", user.id).single();
      const { data: nuevaFamilia, error } = await supabase
        .from("familias")
        .insert({ tutor_perfil_id: user.id, tutor_nombre: perfil?.nombre_completo ?? "", tutor_cedula: user.id, tutor_email: user.email })
        .select("id")
        .single();
      if (error || !nuevaFamilia) {
        setMensaje("No se pudo crear tu familia: " + error?.message);
        setGuardando(false);
        return;
      }
      familia = nuevaFamilia;
    }

    // Evitar que un mismo responsable inscriba dos veces al mismo hijo/a:
    // se compara por cédula (si tiene) o por nombre completo (si no tiene cédula).
    const { data: existentes } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula")
      .eq("familia_id", familia.id);

    const cedulaLimpia = sinCedula ? "" : cedula.trim().toLowerCase();
    const nombreLimpio = nombre.trim().toLowerCase();
    const yaExiste = (existentes ?? []).some((est) => {
      if (cedulaLimpia) return (est.cedula ?? "").trim().toLowerCase() === cedulaLimpia;
      return est.nombre_completo.trim().toLowerCase() === nombreLimpio;
    });

    if (yaExiste) {
      setMensaje("Ya inscribiste a un hijo/a con estos datos. Si es un error, comunicate con la institución.");
      setGuardando(false);
      return;
    }

    const { data: estudiante, error: errorEstudiante } = await supabase
      .from("estudiantes")
      .insert({
        familia_id: familia.id,
        nombre_completo: nombre,
        cedula: sinCedula ? null : cedula.trim(),
        fecha_nacimiento: fechaNacimiento || null,
      })
      .select("id")
      .single();

    if (errorEstudiante || !estudiante) {
      if (errorEstudiante?.code === "23505") {
        setMensaje("Ya inscribiste a un hijo/a con esta cédula.");
      } else {
        setMensaje("No se pudo registrar: " + errorEstudiante?.message);
      }
      setGuardando(false);
      return;
    }

    await supabase.from("inscripciones").insert({ estudiante_id: estudiante.id, curso_solicitado_id: cursoId || null, estado: "pendiente" });

    setMensaje("Inscripción enviada. La institución la va a revisar.");
    setNombre("");
    setCedula("");
    setSinCedula(false);
    setFechaNacimiento("");
    setCursoId("");
    setGuardando(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Inscripción</h1>
        <p className="text-sm text-text-soft mt-1">Sumá a otro hijo/a a tu cuenta familiar.</p>
      </div>

      <form onSubmit={enviar} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Nombre completo del hijo/a
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Número de cédula del hijo/a
            <input
              required={!sinCedula}
              disabled={sinCedula}
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="h-11 rounded-lg border border-border px-3 text-sm bg-card disabled:opacity-50"
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
          <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Curso al que postula
          <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card">
            <option value="">Seleccionar…</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grado} {c.enfasis ? `— ${c.enfasis}` : ""} — Turno {c.turno}
              </option>
            ))}
          </select>
        </label>
        {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}
        <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6">
          {guardando ? "Enviando…" : "Enviar inscripción"}
        </button>
      </form>
    </div>
  );
}
