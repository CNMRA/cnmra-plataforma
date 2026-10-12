"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Perfil = { id: string; nombre_completo: string; rol: string; activo: boolean };

export default function UsuariosInstitucional() {
  const supabase = createClient();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [userId, setUserId] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("carga_datos");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, rol, activo")
      .in("rol", ["director", "carga_datos"])
      .order("rol");
    setPerfiles(data ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase.from("perfiles").insert({ id: userId, nombre_completo: nombre, rol });
    if (error) {
      setMensaje("No se pudo guardar: " + error.message);
    } else {
      setMensaje("Usuario agregado.");
      setUserId("");
      setNombre("");
      cargar();
    }
    setGuardando(false);
  }

  const director = perfiles.find((p) => p.rol === "director");
  const equipo = perfiles.filter((p) => p.rol === "carga_datos");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Usuarios institucionales</h1>
        <p className="text-sm text-text-soft mt-1 max-w-xl">
          Cada persona ingresa con su propia cuenta. Todas las cargas y
          modificaciones quedan registradas con su nombre.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-[11px] font-semibold text-text-soft tracking-wide mb-2">DIRECCIÓN</div>
        {director ? (
          <div className="text-sm font-medium">{director.nombre_completo}</div>
        ) : (
          <p className="text-sm text-text-soft">Sin director asignado todavía.</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-[11px] font-semibold text-text-soft tracking-wide mb-3">
          EQUIPO DE CARGA DE DATOS ({equipo.length})
        </div>
        <div className="flex flex-col">
          {equipo.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-none text-sm">
              <span>{p.nombre_completo}</span>
              <span className="text-xs text-text-soft">{p.activo ? "Activa" : "Inactiva"}</span>
            </div>
          ))}
          {equipo.length === 0 && <p className="text-sm text-text-soft">Todavía no hay cuentas cargadas.</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-lg mb-2">Agregar usuario</h3>
        <p className="text-xs text-text-soft mb-4 leading-relaxed">
          Primero creá la cuenta en Supabase (Authentication → Add user, con su
          correo y una contraseña provisoria) y copiá el <b>User UID</b> que te da.
          Pegalo acá para asignarle nombre y rol dentro de la plataforma.
        </p>
        <form onSubmit={agregar} className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium flex-1">
            User UID (de Supabase)
            <input value={userId} onChange={(e) => setUserId(e.target.value)} required className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium flex-1">
            Nombre completo
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card md:w-auto">
              <option value="carga_datos">Carga de datos</option>
              <option value="director">Director</option>
            </select>
          </label>
          <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full md:w-auto">
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
        {mensaje && <p className="text-sm text-text-soft mt-3">{mensaje}</p>}
      </div>
    </div>
  );
}
