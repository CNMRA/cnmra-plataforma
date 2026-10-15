"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Candidato = { estudianteId: string; nombre: string };

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_LECTIVOS = [ANIO_ACTUAL, ANIO_ACTUAL + 1, ANIO_ACTUAL + 2];

export default function InscripcionFamilia() {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sinCedula, setSinCedula] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [anioLectivo, setAnioLectivo] = useState(String(ANIO_ACTUAL));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    supabase.from("cursos").select("id, grado, turno, enfasis").order("orden").then(({ data }) => setCursos(data ?? []));
  }, [supabase]);

  async function obtenerOCrearMiFamilia(userId: string, email: string | undefined) {
    let { data: familia } = await supabase.from("familias").select("id").eq("tutor_perfil_id", userId).maybeSingle();

    if (!familia) {
      const { data: perfil } = await supabase.from("perfiles").select("nombre_completo").eq("id", userId).single();
      const { data: nuevaFamilia, error } = await supabase
        .from("familias")
        .insert({ tutor_perfil_id: userId, tutor_nombre: perfil?.nombre_completo ?? "", tutor_cedula: userId, tutor_email: email })
        .select("id")
        .single();
      if (error || !nuevaFamilia) {
        return { familia: null, error };
      }
      familia = nuevaFamilia;
    }
    return { familia, error: null };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!sinCedula && !cedula.trim()) {
      setMensaje("Ingresá el número de cédula, o marcá \"No tiene cédula todavía\".");
      return;
    }

    setGuardando(true);
    setMensaje(null);
    setCandidato(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar si la institución ya cargó a este estudiante (por cédula o por nombre
    // exacto) pero todavía ninguna familia lo "reclamó" desde su cuenta — para no
    // crear un duplicado y, en cambio, ofrecer vincularlo directamente. Esto usa una
    // función especial en la base de datos (no una consulta directa a "estudiantes"),
    // porque una familia normal no tiene permiso para ver estudiantes de otras
    // familias, y esa función es la única forma segura de encontrar la coincidencia.
    const cedulaLimpia = sinCedula ? "" : cedula.trim();
    const nombreLimpio = nombre.trim();

    const { data: coincidencias } = await supabase.rpc("buscar_estudiante_no_reclamado", {
      p_cedula: cedulaLimpia || null,
      p_nombre: cedulaLimpia ? null : nombreLimpio,
    });
    const encontrado = coincidencias && coincidencias.length > 0 ? coincidencias[0] : null;

    if (encontrado) {
      setCandidato({ estudianteId: encontrado.id, nombre: encontrado.nombre_completo });
      setGuardando(false);
      return;
    }

    const { familia, error: errorFamilia } = await obtenerOCrearMiFamilia(user.id, user.email);
    if (!familia) {
      setMensaje("No se pudo crear tu familia: " + errorFamilia?.message);
      setGuardando(false);
      return;
    }

    // Evitar que un mismo responsable inscriba dos veces al mismo hijo/a:
    // se compara por cédula (si tiene) o por nombre completo (si no tiene cédula).
    const { data: existentes } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula")
      .eq("familia_id", familia.id);

    const cedulaLimpiaMin = cedulaLimpia.toLowerCase();
    const nombreLimpioMin = nombreLimpio.toLowerCase();
    const yaExiste = (existentes ?? []).some((est) => {
      if (cedulaLimpiaMin) return (est.cedula ?? "").trim().toLowerCase() === cedulaLimpiaMin;
      return est.nombre_completo.trim().toLowerCase() === nombreLimpioMin;
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

    await supabase.from("inscripciones").insert({
      estudiante_id: estudiante.id,
      curso_solicitado_id: cursoId || null,
      anio_lectivo: Number(anioLectivo),
      estado: "pendiente",
    });

    setMensaje("Inscripción enviada. La institución la va a revisar.");
    setNombre("");
    setCedula("");
    setSinCedula(false);
    setFechaNacimiento("");
    setCursoId("");
    setAnioLectivo(String(ANIO_ACTUAL));
    setGuardando(false);
  }

  async function confirmarVinculacion() {
    if (!candidato) return;
    setVinculando(true);
    setMensaje(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setVinculando(false);
      return;
    }

    const { familia, error: errorFamilia } = await obtenerOCrearMiFamilia(user.id, user.email);
    if (!familia) {
      setMensaje("No se pudo vincular: " + errorFamilia?.message);
      setVinculando(false);
      return;
    }

    const { error } = await supabase.from("estudiantes").update({ familia_id: familia.id }).eq("id", candidato.estudianteId);

    setVinculando(false);

    if (error) {
      setMensaje("No se pudo vincular: " + error.message);
      return;
    }

    setMensaje(`${candidato.nombre} fue vinculado/a a tu cuenta. Ya lo/la vas a ver en Inicio.`);
    setCandidato(null);
    setNombre("");
    setCedula("");
    setSinCedula(false);
    setFechaNacimiento("");
    setCursoId("");
    setAnioLectivo(String(ANIO_ACTUAL));
  }

  function noEsElMismo() {
    setCandidato(null);
    setMensaje(
      "Entendido, no era ese estudiante. Revisá que el nombre y la cédula estén bien escritos y volvé a enviar la inscripción."
    );
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
          Año lectivo
          <select
            required
            value={anioLectivo}
            onChange={(e) => setAnioLectivo(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
          >
            {ANIOS_LECTIVOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
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

        {candidato && (
          <div className="bg-bg border border-border rounded-lg p-4 flex flex-col gap-3">
            <p className="text-sm">
              Encontramos un estudiante ya cargado que coincide: <strong>{candidato.nombre}</strong>. ¿Es a quien
              querés inscribir?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={vinculando}
                onClick={confirmarVinculacion}
                className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-4 disabled:opacity-50"
              >
                {vinculando ? "Vinculando…" : "Sí, es mi hijo/a"}
              </button>
              <button
                type="button"
                disabled={vinculando}
                onClick={noEsElMismo}
                className="h-10 rounded-lg border border-border font-semibold text-sm px-4 disabled:opacity-50"
              >
                No, es otro/a
              </button>
            </div>
          </div>
        )}

        {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}
        <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6">
          {guardando ? "Enviando…" : "Enviar inscripción"}
        </button>
      </form>
    </div>
  );
}
