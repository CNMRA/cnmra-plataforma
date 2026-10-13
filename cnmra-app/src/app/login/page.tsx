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
    <div className="min-h-screen flex flex-col">
      <div className="bg-gradient-to-r from-navy-dark to-navy text-white px-6 md:px-14 py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="Escudo CNMRA" width={40} height={40} className="rounded bg-white object-contain" />
          <div>
            <div className="font-display font-bold text-base leading-tight">CNMRA</div>
            <div className="text-[10px] tracking-wide text-white/70">
              COLEGIO NACIONAL MARIANO ROQUE ALONSO
            </div>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-gold bg-white/10 rounded-full px-3.5 py-1.5 whitespace-nowrap">
          DESDE 1980 · {anios} AÑOS
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center gap-12 md:gap-16 px-6 md:px-14 py-10 md:py-14">
        <div className="flex-1 max-w-md">
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-teal rounded-full px-4 py-1.5 text-base font-bold mb-4">
            2026–2030
          </span>
          <h1 className="font-display text-[26px] md:text-[28px] leading-snug text-navy">
            Una educación de calidad, como bien público y derecho de todos y todas.
          </h1>
          <p className="text-sm leading-relaxed text-text-soft mt-4">
            Nuestra visión: ser un <i>ñanderekoha</i> educativo, promoviendo el
            bienestar, la autenticidad de cada persona y el compromiso colectivo
            con la equidad, la justicia social y la formación integral,
            sustentada en valores humanos, democráticos e inclusivos, donde la
            diversidad es reconocida como una fuente de aprendizaje y de
            transformación social.
          </p>
          <div className="text-xs text-text-soft/70 mt-7">
            Barrio Corumbá Cué · Mariano Roque Alonso, Paraguay
          </div>
        </div>

        <div className="w-full max-w-sm relative">
          <div className="absolute -top-12 right-0 md:-top-14">
            <InstallButton />
          </div>
          <form
            onSubmit={ingresar}
            className="flex flex-col gap-5 bg-card border-t-4 border-gold rounded-2xl shadow-xl p-9"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-bg border border-border flex items-center justify-center">
                <Image src="/logo.jpg" alt="Escudo CNMRA" width={56} height={56} className="rounded object-contain" />
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
                className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg focus:outline-none focus:border-teal"
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
                className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg focus:outline-none focus:border-teal"
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
              className="h-12 rounded-lg bg-navy text-white font-semibold text-sm shadow-lg disabled:opacity-60"
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
    </div>
  );
}
