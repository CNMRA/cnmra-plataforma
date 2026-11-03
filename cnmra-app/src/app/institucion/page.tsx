import { createClient } from "@/lib/supabase/server";
import EstudiantesResumen from "@/components/EstudiantesResumen";
import PanelSegunAnio from "@/components/PanelSegunAnio";

export default async function PanelInstitucional() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("rol, acompanamiento").eq("id", user.id).single()
    : { data: null };

  const veDocentes =
    perfil?.rol === "director" || (perfil?.rol === "carga_datos" && perfil?.acompanamiento === true);

  return <PanelSegunAnio veDocentes={veDocentes} resumen={<EstudiantesResumen conVolver={false} />} />;
}
