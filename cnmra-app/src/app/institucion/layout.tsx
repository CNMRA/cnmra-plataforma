import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InstitucionSidebar from "@/components/InstitucionSidebar";
import { AnioLectivoProvider } from "@/lib/anio-lectivo";

export default async function InstitucionLayout({
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

  if (!perfil || (perfil.rol !== "director" && perfil.rol !== "carga_datos")) {
    redirect("/login");
  }

  return (
    <AnioLectivoProvider>
      <div className="flex flex-col md:flex-row min-h-screen bg-bg">
        <InstitucionSidebar nombre={perfil.nombre_completo} rol={perfil.rol} />
        <div className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">{children}</div>
      </div>
    </AnioLectivoProvider>
  );
}
