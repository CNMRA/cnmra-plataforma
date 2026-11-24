"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hoyParaguay, sincronizarReloj } from "@/lib/reloj-servidor";

type Candidato = { estudianteId: string; nombre: string };

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

// Desde esta fecha (hora de Paraguay) la matriculación 2027 está abierta para todas las familias.
const FECHA_APERTURA_MATRICULACION = "2026-11-23";

function matriculacionAbierta(): boolean {
  return hoyParaguay() >= FECHA_APERTURA_MATRICULACION;
}

export default function Matriculacion2027Nuevo() {
  const supabase = createClient();
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [sesionVencida, setSesionVencida] = useState(false);

  const [apellido, setApellido] = useState("");
  const [nombrePila, setNombrePila] = useState("");
  const [cedula, setCedula] = useState("");
  const [sinCedula, setSinCedula] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [yaCargado, setYaCargado] = useState<Candidato | null>(null);
  const avisoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mensaje && avisoRef.current) {
      avisoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [mensaje]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSesionVencida(true);
          setCargando(false);
          return;
        }
        await sincronizarReloj();
        const { data: familia } = await supabase
          .from("familias")
          .select("matriculacion_2027_habilitada")
          .eq("tutor_perfil_id", user.id)
          .maybeSingle();
        if (!matriculacionAbierta() && !familia?.matriculacion_2027_habilitada) {
          setSinAcceso(true);
        }
      } catch (err) {
        console.error(err);
      }
      setCargando(false);
    })();
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
      setMensaje('Ingresá el número de cédula, o marcá "No tiene cédula todavía".');
      return;
    }

    setGuardando(true);
    setMensaje(null);
    setCandidato(null);
    setYaCargado(null);

    try {
      await procesarEnvio();
    } catch (err) {
      setMensaje("Ocurrió un problema de conexión. Revisá tu internet y probá de nuevo. Si sigue igual, avisá al colegio.");
      setGuardando(false);
      console.error(err);
    }
  }

  async function procesarEnvio() {
    const nombreCompleto = `${apellido.trim()} ${nombrePila.trim()}`.replace(/\s+/g, " ").trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMensaje("Tu sesión venció. Cerrá sesión, volvé a ingresar con tu correo y probá de nuevo.");
      setGuardando(false);
      return;
    }

    const cedulaLimpia = sinCedula ? "" : soloDigitos(cedula);
    const nombreNormalizado = normalizar(nombreCompleto);
    const usarCedulaComoClave = !sinCedula && Boolean(cedulaLimpia);

    const { data: posibles, error: errorBusqueda } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula, familia_id, familias(tutor_perfil_id)");

    if (errorBusqueda) {
      setMensaje("No se pudo buscar al estudiante: " + errorBusqueda.message);
      setGuardando(false);
      return;
    }

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

    const yaExiste = (existentes ?? []).find((est) => {
      if (usarCedulaComoClave) {
        return Boolean(est.cedula) && soloDigitos(est.cedula) === cedulaLimpia;
      }
      return normalizar(est.nombre_completo) === nombreNormalizado;
    });

    if (yaExiste) {
      setYaCargado({ estudianteId: yaExiste.id, nombre: yaExiste.nombre_completo });
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
        setMensaje("Esa cédula ya está registrada en otra familia o en tu lista. Comunicate con Secretaría del colegio para que lo revisen.");
      } else {
        setMensaje("No se pudo registrar: " + errorEstudiante?.message);
      }
      setGuardando(false);
      return;
    }

    router.push(`/familia/matriculacion-2027/${estudiante.id}`);
  }

  async function confirmarVinculacion() {
    if (!candidato) return;
    setVinculando(true);
    setMensaje(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMensaje("Tu sesión venció. Cerrá sesión, volvé a ingresar con tu correo y probá de nuevo.");
      setVinculando(false);
      return;
    }

    const { familia, error: errorFamilia } = await obtenerOCrearMiFamilia(user.id, user.email);
    if (!familia) {
      setMensaje("No se pudo vincular: " + errorFamilia?.message);
      setVinculando(false);
      return;
    }

    const { data: vinculado, error } = await supabase.rpc("vincular_estudiante_a_mi_familia", {
      p_estudiante_id: candidato.estudianteId,
    });

    setVinculando(false);

    if (error) {
      setMensaje("No se pudo vincular: " + error.message);
      return;
    }

    if (!vinculado) {
      setMensaje("No se pudo vincular a este estudiante porque ya pertenece a otra familia. Escribile al colegio para que lo revisen.");
      setCandidato(null);
      return;
    }

    router.push(`/familia/matriculacion-2027/${candidato.estudianteId}`);
  }

  function noEsElMismo() {
    setCandidato(null);
    setMensaje("Entendido, no era ese estudiante. Revisá que el nombre y la cédula estén bien escritos y volvé a enviar.");
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (sesionVencida) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        Tu sesión venció. Volvé a ingresar con tu correo y tu contraseña.{" "}
        <Link href="/login" className="text-teal font-medium">
          Ir a ingresar
        </Link>
      </div>
    );
  }

  if (sinAcceso) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        No tenés acceso a esta pantalla.{" "}
        <Link href="/familia" className="text-teal font-medium">
          Volver a Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/familia/matriculacion-2027" className="text-xs text-teal font-medium">
          ← Volver a la lista
        </Link>
        <h1 className="font-display text-2xl mt-1">Inscribir un hijo/a nuevo — Matriculación 2027</h1>
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

        {candidato && (
          <div className="bg-bg border border-border rounded-lg p-4 flex flex-col gap-3">
            <p className="text-sm">
              Encontramos un estudiante ya cargado que coincide: <strong>{candidato.nombre}</strong>. ¿Es a quien
              querés matricular?
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

        {yaCargado && (
          <div className="bg-bg border border-border rounded-lg p-4 flex flex-col gap-3">
            <p className="text-sm">
              <strong>{yaCargado.nombre}</strong> ya está en tu lista. No hace falta cargarlo de nuevo: tocá el botón para
              continuar con su ficha de matriculación 2027.
            </p>
            <Link
              href={`/familia/matriculacion-2027/${yaCargado.estudianteId}`}
              className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-4 w-fit inline-flex items-center"
            >
              Continuar con la ficha de {yaCargado.nombre}
            </Link>
          </div>
        )}

        {mensaje && (
          <div ref={avisoRef} className="text-sm font-medium text-navy bg-bg border border-border rounded-lg px-3 py-3">
            {mensaje}
          </div>
        )}
        <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6">
          {guardando ? "Guardando…" : "Continuar con la ficha"}
        </button>
      </form>
    </div>
  );
}
