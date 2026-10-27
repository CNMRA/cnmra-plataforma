import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FamiliaNav from "@/components/FamiliaNav";
import VolverInicio from "@/components/VolverInicio";

export default async function FamiliaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "familia") redirect("/login");

  const { data: familia } = await supabase
    .from("familias")
    .select("matriculacion_2027_habilitada")
    .eq("tutor_perfil_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-bg pb-20 md:pb-0">
      <div className="print:hidden">
        <FamiliaNav
          nombre={perfil.nombre_completo}
          matriculacion2027Habilitada={familia?.matriculacion_2027_habilitada ?? false}
        />
      </div>
      <div className="max-w-3xl mx-auto p-5 md:p-8 flex flex-col gap-4 print:p-0 print:max-w-none print:block">
        <div className="print:hidden">
          <VolverInicio />
        </div>
        {children}
      </div>
    </div>
  );
}
