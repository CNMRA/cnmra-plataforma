"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Estudiante = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  fecha_nacimiento: string | null;
};

export default function EditarEstudianteFamilia({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sinCedula, setSinCedula] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula, fecha_nacimiento")
      .eq("id", estudianteId)
      .maybeSingle();

    if (!data) {
      setNoEncontrado(true);
      setCargando(false);
      return;
    }

    setEstudiante(data);
    setNombre(data.nombre_completo);
    setCedula(data.cedula ?? "");
    setSinCedula(!data.cedula);
    setFechaNacimiento(data.fecha_nacimiento ?? "");
    setCargando(false);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!sinCedula && !cedula.trim()) {
      setMensaje('Ingresá la cédula, o marcá "No tiene cédula todavía".');
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const { error } = await supabase
      .from("estudiantes")
      .update({
        nombre_completo: nombre.trim(),
        cedula: sinCedula ? null : cedula.trim(),
        fecha_nacimiento: fechaNacimiento || null,
      })
      .eq("id", estudianteId);

    setGuardando(false);

    if (error) {
      if (error.code === "23505") {
        setMensaje("Ya existe otro hijo/a cargado con esta misma cédula. Revisá el número.");
      } else {
        setMensaje("No se pudo guardar: " + error.message);
      }
      return;
    }

    setExito(true);
    setMensaje("Datos actualizados correctamente.");
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (noEncontrado || !estudiante) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        No se encontró este estudiante, o no tenés permiso para editarlo.{" "}
        <Link href="/familia" className="text-teal font-medium">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/familia" className="text-xs text-teal font-medium">
          ← Volver
        </Link>
        <h1 className="font-display text-2xl mt-1">Editar datos de {estudiante.nombre_completo}</h1>
        <p className="text-sm text-text-soft mt-1">
          Corregí el nombre, la cédula o la fecha de nacimiento si hay algún error.
        </p>
      </div>

      <form onSubmit={guardar} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Nombre y apellido
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Número de cédula
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

        {mensaje && (
          <div className={`text-sm rounded-lg px-3 py-2 ${exito ? "text-success bg-[#E7F3EB]" : "text-text-soft bg-bg"}`}>
            {mensaje}
          </div>
        )}

        <div className="flex gap-3">
          <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm px-6">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" onClick={() => router.push("/familia")} className="h-11 rounded-lg border border-border text-sm font-semibold px-6">
            Volver
          </button>
        </div>
      </form>
    </div>
  );
}
