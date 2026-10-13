"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegistroFamilia() {
  const supabase = createClient();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const { data, error: errorSignUp } = await supabase.auth.signUp({ email, password });
    if (errorSignUp || !data.user) {
      setError(errorSignUp?.message ?? "No se pudo crear la cuenta.");
      setCargando(false);
      return;
    }

    const { error: errorPerfil } = await supabase
      .from("perfiles")
      .insert({ id: data.user.id, nombre_completo: nombre, rol: "familia" });

    if (errorPerfil) {
      setError("Cuenta creada, pero no se pudo guardar tu perfil: " + errorPerfil.message);
      setCargando(false);
      return;
    }

    const { error: errorFamilia } = await supabase.from("familias").insert({
      tutor_perfil_id: data.user.id,
      tutor_nombre: nombre,
      tutor_cedula: cedula,
      tutor_telefono: telefono,
      tutor_email: email,
    });

    if (errorFamilia) {
      setError("Perfil creado, pero no se pudo guardar la familia: " + errorFamilia.message);
      setCargando(false);
      return;
    }

    router.push("/familia/inscripcion");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={registrar} className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <Image src="/logo.jpg" alt="CNMRA" width={64} height={64} className="rounded object-contain" />
          <div>
            <h1 className="font-display text-2xl">Crear cuenta familiar</h1>
            <p className="text-sm text-text-soft mt-1">Para inscribir a tu hijo/a por primera vez.</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Tu nombre completo
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Tu cédula de identidad
          <input required value={cedula} onChange={(e) => setCedula(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Tu número de teléfono
          <input
            required
            type="tel"
            placeholder="0981 123 456"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Correo electrónico
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Contraseña
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
        </label>

        {error && <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <button disabled={cargando} className="h-12 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-60">
          {cargando ? "Creando cuenta…" : "Crear cuenta y continuar"}
        </button>

        <a href="/login" className="text-sm text-text-soft text-center">
          Ya tengo cuenta — <span className="text-teal font-medium">iniciar sesión</span>
        </a>
      </form>
    </div>
  );
}
