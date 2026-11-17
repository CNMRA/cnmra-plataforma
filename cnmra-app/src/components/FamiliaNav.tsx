"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Encabezado de la zona de familias: logo, nombre y botón Salir.
// El menú de navegación se quitó: todo se accede desde los botones de la pantalla principal.
export default function FamiliaNav({
  nombre,
}: {
  nombre: string;
  matriculacion2027Habilitada?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-16 flex-none bg-card border-b border-border flex items-center justify-between px-5 md:px-8">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.jpg" alt="CNMRA" width={30} height={30} className="rounded object-contain" />
        <span className="font-display font-bold text-sm">CNMRA</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] text-text-soft hidden sm:inline">{nombre}</span>
        <button onClick={salir} className="text-[12.5px] text-teal font-medium">
          Salir
        </button>
      </div>
    </div>
  );
}
