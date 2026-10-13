"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/InstallButton";

const ANIO_FUNDACION = 1980;

/** Años desde la fundación (3 de marzo de 1980), sumando uno recién a partir de esa fecha cada año. */
function aniosDesdeFundacion(hoy: Date): number {
  const fundacionEsteAnio = new Date(hoy.getFullYear(), 2, 3); // 3 de marzo
  const yaPaso = hoy.getTime() >= fundacionEsteAnio.getTime();
  return hoy.getFullYear() - ANIO_FUNDACION - (yaPaso ? 0 : 1);
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anios = aniosDesdeFundacion(new Date());

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", data.user.id)
      .single();

    if (!perfil) {
      setError("Tu cuenta no tiene un perfil asignado todavía. Contactá a Dirección.");
      setLoading(false);
      return;
    }

    if (perfil.rol === "director" || perfil.rol === "carga_datos") {
      router.push("/institucion");
    } else {
      router.push("/familia");
    }
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="relative flex-none md:w-[42%] bg-gradient-to-br from-navy to-navy-dark text-white p-10 md:p-14 flex flex-col justify-between gap-10 overflow-hidden">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="Escudo CNMRA" width={44} height={44} className="rounded object-contain" />
              <div>
                <div className="font-display font-bold text-lg leading-tight">CNMRA</div>
                <div className="text-[10px] tracking-wide text-white/70">
                  COLEGIO NACIONAL MARIANO ROQUE ALONSO
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-gold border border-gold/50 rounded-full px-3 py-1 whitespace-nowrap">
              DESDE 1980 · {anios} AÑOS
            </span>
          </div>

          <div>
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-base font-bold tracking-wide text-gold mb-4">
              2026–2030
            </span>
            <h1 className="font-display text-3xl leading-tight max-w-sm">
              Una educación de calidad, como bien público y derecho de todos y todas.
            </h1>
            <p className="text-sm leading-relaxed text-white/75 max-w-sm mt-4">
              Nuestra visión: ser un <i>ñanderekoha</i> educativo, promoviendo el
              bienestar, la autenticidad de cada persona y el compromiso colectivo
              con la equidad, la justicia social y la formación integral,
              sustentada en valores humanos, democráticos e inclusivos, donde la
              diversidad es reconocida como una fuente de aprendizaje y de
              transformación social.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-white/50 leading-relaxed">
          Barrio Corumbá Cué · Mariano Roque Alonso, Paraguay
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 md:p-10 relative">
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <InstallButton />
        </div>
        <form onSubmit={ingresar} className="w-full max-w-sm flex flex-col gap-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-24 h-24 rounded-full bg-white border border-border shadow-md flex items-center justify-center">
              <Image src="/logo.jpg" alt="Escudo CNMRA" width={68} height={68} className="rounded object-contain" />
            </div>
            <div>
              <h2 className="font-display text-2xl">Iniciar sesión</h2>
              <p className="text-sm text-text-soft mt-1">
                Accedé a tu cuenta.
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Correo electrónico
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
              className="h-11 rounded-lg border border-border px-3.5 text-sm bg-card focus:outline-none focus:border-teal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Contraseña
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-lg border border-border px-3.5 text-sm bg-card focus:outline-none focus:border-teal"
            />
          </label>

          {error && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-lg bg-gradient-to-br from-navy to-navy-dark text-white font-semibold text-sm shadow-lg disabled:opacity-60"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>

          <div className="text-[13px] text-text-soft text-center">
            ¿Familia nueva?{" "}
            <a href="/registro" className="text-teal font-medium">
              Iniciar inscripción
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
