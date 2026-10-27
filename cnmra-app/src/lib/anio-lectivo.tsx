"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Año cuyos datos de sección siguen "en vivo" (Asistencia, Notas, Anotaciones).
// No cambiar este número hasta el día que hagamos el pase de año oficial a 2027.
export const ANIO_LECTIVO_ACTIVO = 2026;

const ANIOS_DISPONIBLES = [2026, 2027] as const;
type Anio = (typeof ANIOS_DISPONIBLES)[number];

const CLAVE_STORAGE = "cnmra_anio_lectivo_admin";

type AnioLectivoContextType = {
  anio: Anio;
  setAnio: (a: Anio) => void;
  anios: readonly Anio[];
};

const AnioLectivoContext = createContext<AnioLectivoContextType | null>(null);

export function AnioLectivoProvider({ children }: { children: ReactNode }) {
  const [anio, setAnioState] = useState<Anio>(2027);

  useEffect(() => {
    const guardado = typeof window !== "undefined" ? window.localStorage.getItem(CLAVE_STORAGE) : null;
    if (guardado === "2026" || guardado === "2027") {
      setAnioState(Number(guardado) as Anio);
    }
  }, []);

  function setAnio(a: Anio) {
    setAnioState(a);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLAVE_STORAGE, String(a));
    }
  }

  return (
    <AnioLectivoContext.Provider value={{ anio, setAnio, anios: ANIOS_DISPONIBLES }}>
      {children}
    </AnioLectivoContext.Provider>
  );
}

export function useAnioLectivo() {
  const ctx = useContext(AnioLectivoContext);
  if (!ctx) throw new Error("useAnioLectivo debe usarse dentro de <AnioLectivoProvider>");
  return ctx;
}
