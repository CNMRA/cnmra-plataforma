"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Candidato = { estudianteId: string; nombre: string };

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_LECTIVOS = [ANIO_ACTUAL, ANIO_ACTUAL + 1];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function soloDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

export default function InscripcionFamilia() {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [apellido, setApellido] = useState("");
  const [nombrePila, setNombrePila] = useState("");
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

    const nombreCompleto = `${apellido.trim()} ${nombrePila.trim()}`.replace(/\s+/g, " ").trim();

    setGuardando(true);
    setMensaje(null);
    setCandidato(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const cedulaLimpia = sinCedula ? "" : soloDigitos(cedula);
    const nombreNormalizado = normalizar(nombreCompleto);
    const usarCedulaComoClave = !sinCedula && Boolean(cedulaLimpia);

    const { data: posibles } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula, familia_id, familias(tutor_perfil_id)");

    const encontrado = (posibles ?? []).find((est) => {
      const fam = est.familias as unknown as { tutor_perfil_id: string | null } | null;
      if (fam && fam.tutor_perfil_id) return false;
      if (usarCedulaComoClave) {
        return Boolean(est.cedula) && soloDigitos(est.cedula) === cedulaLimpia;
      }
      return normalizar(est.nombre_completo) === nombreNormalizado;
    });

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

    const { data: existentes } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula")
      .eq("familia_id", familia.id);

    const yaExiste = (existentes ?? []).some((est) => {
      if (usarCedulaComoClave) {
        return Boolean(est.cedula) && soloDigitos(est.cedula) === cedulaLimpia;
      }
      return normalizar(est.nombre_completo) === nombreNormalizado;
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
        nombre_completo: nombreCompleto,
        cedula: sinCedula ? null : cedulaLimpia,
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
    setApellido("");
    setNombrePila("");
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
    setApellido("");
    setNombrePila("");
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
          Apellido(s) del hijo/a
          <input
  required
  minLength={3}
  value={apellido}
  onChange={(e) => setApellido(e.target.value)}
  placeholder="Ej: Gonzalez Benitez"
  className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
/>
          <span className="text-[11.5px] text-text-soft font-normal">Escribilo completo — si tiene dos apellidos, los dos.</span>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Nombre(s) del hijo/a
          <input
  required
  minLength={3}
  value={nombrePila}
  onChange={(e) => setNombrePila(e.target.value)}
  placeholder="Ej: Juan Carlos"
  className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
/>
          <span className="text-[11.5px] text-text-soft font-normal">Escribilo completo — si tiene más de un nombre, todos.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Número de cédula del hijo/a
            <input
              required={!sinCedula}
              disabled={sinCedula}
              inputMode="numeric"
              value={cedula}
              onChange={(e) => setCedula(soloDigitos(e.target.value))}
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
