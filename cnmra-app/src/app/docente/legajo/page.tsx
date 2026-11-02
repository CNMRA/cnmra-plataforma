"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOCENTES, MAX_BYTES_ARCHIVO, comprimirImagen, extensionDe, mimeDe, nombreSeguro } from "@/lib/docentes";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Disciplina = { id: string; nombre: string };
type Titulo = { titulo: string; institucion: string; anio: string; path: string | null; nombre: string | null };
type PaginaJpeg = { bytes: Uint8Array; ancho: number; alto: number };

/** Arma un PDF simple con una foto (JPEG) por página, sin librerías externas. */
function construirPdf(paginas: PaginaJpeg[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let largo = 0;

  const poner = (dato: Uint8Array | string) => {
    const b = typeof dato === "string" ? enc.encode(dato) : dato;
    partes.push(b);
    largo += b.length;
  };
  const abrir = (n: number) => {
    offsets[n] = largo;
  };

  const total = 2 + paginas.length * 3;
  poner("%PDF-1.4\n");

  abrir(1);
  poner("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const hijos = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  abrir(2);
  poner(`2 0 obj\n<< /Type /Pages /Kids [${hijos}] /Count ${paginas.length} >>\nendobj\n`);

  paginas.forEach((p, i) => {
    const idPagina = 3 + i * 3;
    const idContenido = idPagina + 1;
    const idImagen = idPagina + 2;
    const escala = 842 / Math.max(p.ancho, p.alto);
    const ancho = (p.ancho * escala).toFixed(2);
    const alto = (p.alto * escala).toFixed(2);

    abrir(idPagina);
    poner(
      `${idPagina} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] ` +
        `/Resources << /XObject << /Im0 ${idImagen} 0 R >> >> /Contents ${idContenido} 0 R >>\nendobj\n`
    );

    const contenido = `q ${ancho} 0 0 ${alto} 0 0 cm /Im0 Do Q`;
    abrir(idContenido);
    poner(`${idContenido} 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`);

    abrir(idImagen);
    poner(
      `${idImagen} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.ancho} /Height ${p.alto} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
    );
    poner(p.bytes);
    poner("\nendstream\nendobj\n");
  });

  const inicioXref = largo;
  poner(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) {
    poner(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  poner(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);

  return new Blob(partes as unknown as BlobPart[], { type: "application/pdf" });
}

type ClaveDoc = "cedula" | "certificacion" | "constancia";
type ArchivoLegajo = { path: string; nombre: string };

const DOCUMENTOS_PERSONAL: { clave: ClaveDoc; label: string; ayuda: string }[] = [
  {
    clave: "cedula",
    label: "Cédula de identidad",
    ayuda: "Foto del frente y del dorso (elegí las dos juntas desde la galería) o un PDF.",
  },
  {
    clave: "certificacion",
    label: "Certificación documental actual (SIGMEC)",
    ayuda: "Foto(s) o PDF de la certificación documental vigente.",
  },
  {
    clave: "constancia",
    label: "Constancia de cargo actual (SIGMEC)",
    ayuda: "Foto(s) o PDF de la constancia de cargo vigente.",
  },
];

type Asignacion = {
  ciclo: string;
  turno: string;
  curso_id: string;
  grado: string;
  enfasis: string | null;
  disciplina_id: string;
  materia: string;
};

const VACIO = {
  nombres: "",
  apellidos: "",
  ci: "",
  fecha_nacimiento: "",
  lugar_nacimiento: "",
  estado_civil: "",
  nacionalidad: "",
  domicilio: "",
  telefono: "",
  telefono2: "",
  correo: "",
  matricula: "",
  fecha_ingreso: "",
  cargo: "",
  situacion: "",
  horas_catedra: "",
  emergencia_nombre: "",
  emergencia_telefono: "",
  capacitaciones: "",
  experiencia: "",
};
type Form = typeof VACIO;
type Clave = keyof Form;

type Campo = {
  k: Clave;
  label: string;
  tipo?: "text" | "date" | "number" | "email" | "tel" | "select" | "textarea";
  opciones?: string[];
  opcional?: boolean;
};

const CAMPOS_PERSONALES: Campo[] = [
  { k: "nombres", label: "Nombres" },
  { k: "apellidos", label: "Apellidos" },
  { k: "ci", label: "Número de cédula" },
  { k: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "date" },
  { k: "lugar_nacimiento", label: "Lugar de nacimiento" },
  {
    k: "estado_civil",
    label: "Estado civil",
    tipo: "select",
    opciones: ["Soltero/a", "Casado/a", "Unión de hecho", "Divorciado/a", "Viudo/a"],
  },
  { k: "nacionalidad", label: "Nacionalidad" },
  { k: "domicilio", label: "Domicilio" },
  { k: "telefono", label: "Teléfono (celular)", tipo: "tel" },
  { k: "telefono2", label: "Otro teléfono", tipo: "tel", opcional: true },
  { k: "correo", label: "Correo electrónico", tipo: "email", opcional: true },
];

const CAMPOS_PROFESIONALES: Campo[] = [
  { k: "matricula", label: "Número de matrícula / registro docente" },
  { k: "fecha_ingreso", label: "Fecha de ingreso al colegio", tipo: "date" },
  { k: "cargo", label: "Cargo" },
  { k: "situacion", label: "Situación", tipo: "select", opciones: ["Permanente", "Contratado/a"] },
  { k: "horas_catedra", label: "Horas cátedra semanales", tipo: "number" },
];

const CAMPOS_EMERGENCIA: Campo[] = [
  { k: "emergencia_nombre", label: "Nombre del contacto de emergencia" },
  { k: "emergencia_telefono", label: "Teléfono del contacto de emergencia", tipo: "tel" },
];

const CAMPOS_EXTRA: Campo[] = [
  { k: "capacitaciones", label: "Cursos y capacitaciones realizados", tipo: "textarea", opcional: true },
  { k: "experiencia", label: "Experiencia laboral anterior", tipo: "textarea", opcional: true },
];

const ESTILO_INPUT =
  "h-11 rounded-lg border border-border px-3.5 text-sm bg-bg focus:outline-none focus:border-teal w-full";

export default function MiLegajoPage() {
  const supabase = createClient();
  const [uid, setUid] = useState("");
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<Form>(VACIO);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Partial<Record<ClaveDoc, ArchivoLegajo>>>({});
  const [enviado, setEnviado] = useState(false);
  const [enviadoEn, setEnviadoEn] = useState<string | null>(null);

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [ciclo, setCiclo] = useState("");
  const [turno, setTurno] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [disciplinaId, setDisciplinaId] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);

    const [{ data: cursosData }, { data: leg }] = await Promise.all([
      supabase.from("cursos").select("id, grado, turno, ciclo, enfasis").order("orden"),
      supabase.from("legajos_docentes").select("*").eq("docente_id", user.id).maybeSingle(),
    ]);

    const lista = (cursosData as Curso[] | null) ?? [];
    setCursos(lista);
    const ciclos = Array.from(new Set(lista.map((c) => String(c.ciclo)))).sort();
    const actual = String(new Date().getFullYear());
    setCiclo(ciclos.includes(actual) ? actual : (ciclos[0] ?? ""));

    if (leg) {
      const registro = leg as Record<string, unknown>;
      const nuevo = { ...VACIO };
      (Object.keys(VACIO) as Clave[]).forEach((k) => {
        nuevo[k] = registro[k] === null || registro[k] === undefined ? "" : String(registro[k]);
      });
      setForm(nuevo);
      setTitulos(((registro.titulos as Titulo[] | null) ?? []).map((t) => ({ ...t })));
      setAsignaciones((registro.asignaciones as Asignacion[] | null) ?? []);
      setDocumentos((registro.documentos as Partial<Record<ClaveDoc, ArchivoLegajo>> | null) ?? {});
      setEnviado(Boolean(registro.enviado));
      setEnviadoEn((registro.enviado_en as string | null) ?? null);
      const path = (registro.foto_path as string | null) ?? null;
      setFotoPath(path);
      if (path) {
        const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 3600);
        setFotoUrl(data?.signedUrl ?? null);
      }
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del legajo
    cargar();
  }, [cargar]);

  const ciclos = useMemo(() => Array.from(new Set(cursos.map((c) => String(c.ciclo)))).sort(), [cursos]);
  const turnos = useMemo(
    () => Array.from(new Set(cursos.filter((c) => String(c.ciclo) === ciclo).map((c) => c.turno))),
    [cursos, ciclo]
  );
  const cursosFiltrados = useMemo(
    () => cursos.filter((c) => String(c.ciclo) === ciclo && c.turno === turno),
    [cursos, ciclo, turno]
  );

  function cambiarCiclo(v: string) {
    setCiclo(v);
    setTurno("");
    setCursoId("");
    setDisciplinas([]);
    setDisciplinaId("");
  }

  function cambiarTurno(v: string) {
    setTurno(v);
    setCursoId("");
    setDisciplinas([]);
    setDisciplinaId("");
  }

  async function cambiarCurso(v: string) {
    setCursoId(v);
    setDisciplinaId("");
    setDisciplinas([]);
    if (!v) return;
    const { data } = await supabase
      .from("disciplinas")
      .select("id, nombre")
      .eq("curso_id", v)
      .order("plan")
      .order("orden");
    setDisciplinas((data as Disciplina[] | null) ?? []);
  }

  function agregarAsignacion() {
    const curso = cursos.find((c) => c.id === cursoId);
    const disc = disciplinas.find((d) => d.id === disciplinaId);
    if (!curso || !disc) return;
    if (asignaciones.some((a) => a.curso_id === curso.id && a.disciplina_id === disc.id)) {
      setMensaje({ tipo: "error", texto: "Esa materia ya está en tu lista." });
      return;
    }
    setMensaje(null);
    setAsignaciones([
      ...asignaciones,
      {
        ciclo: String(curso.ciclo),
        turno: curso.turno,
        curso_id: curso.id,
        grado: curso.grado,
        enfasis: curso.enfasis,
        disciplina_id: disc.id,
        materia: disc.nombre,
      },
    ]);
    setDisciplinaId("");
  }

  function quitarAsignacion(i: number) {
    setAsignaciones(asignaciones.filter((_, n) => n !== i));
  }

  async function persistir(parcial: Record<string, unknown>) {
    const { error } = await supabase
      .from("legajos_docentes")
      .upsert(
        { docente_id: uid, ...parcial, actualizado_en: new Date().toISOString() },
        { onConflict: "docente_id" }
      );
    return error;
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setMensaje({ tipo: "error", texto: "La foto tiene que ser una imagen." });
      return;
    }
    setSubiendo("foto");
    setMensaje(null);
    try {
      const { blob } = await comprimirImagen(archivo);
      const path = `${uid}/legajo/foto-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET_DOCENTES).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      const errGuardar = await persistir({ foto_path: path });
      if (errGuardar) throw new Error(errGuardar.message);
      const anterior = fotoPath;
      setFotoPath(path);
      const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 3600);
      setFotoUrl(data?.signedUrl ?? null);
      if (anterior) await supabase.storage.from(BUCKET_DOCENTES).remove([anterior]);
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se pudo subir la foto: " + (err as Error).message });
    }
    setSubiendo(null);
  }

  async function subirDocumento(clave: ClaveDoc, e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (elegidos.length === 0) return;
    const imagenes = elegidos.filter((f) => f.type.startsWith("image/"));
    const pdfs = elegidos.filter((f) => !f.type.startsWith("image/") && extensionDe(f.name) === "pdf");
    if (imagenes.length + pdfs.length !== elegidos.length || (imagenes.length > 0 && pdfs.length > 0) || pdfs.length > 1) {
      setMensaje({ tipo: "error", texto: "Subí fotos (varias si hace falta) o un único PDF, pero no mezclados." });
      return;
    }
    if (imagenes.length > 6) {
      setMensaje({ tipo: "error", texto: "Podés subir hasta 6 fotos por documento." });
      return;
    }
    setSubiendo(`doc-${clave}`);
    setMensaje(null);
    try {
      let cuerpo: Blob;
      let nombre: string;
      if (imagenes.length > 0) {
        const paginas: PaginaJpeg[] = [];
        for (const img of imagenes) {
          const { blob } = await comprimirImagen(img);
          const bmp = await createImageBitmap(blob);
          const ancho = bmp.width;
          const alto = bmp.height;
          bmp.close();
          paginas.push({ bytes: new Uint8Array(await blob.arrayBuffer()), ancho, alto });
        }
        cuerpo = construirPdf(paginas);
        nombre = `${clave}.pdf`;
      } else {
        cuerpo = pdfs[0];
        nombre = pdfs[0].name;
      }
      if (cuerpo.size > MAX_BYTES_ARCHIVO) throw new Error("El archivo pesa más de 10 MB.");

      const path = `${uid}/legajo/${clave}-${Date.now()}.pdf`;
      const { error } = await supabase.storage.from(BUCKET_DOCENTES).upload(path, cuerpo, { contentType: "application/pdf" });
      if (error) throw new Error(error.message);

      const anterior = documentos[clave]?.path ?? null;
      const nuevos = { ...documentos, [clave]: { path, nombre } };
      const errGuardar = await persistir({ documentos: nuevos });
      if (errGuardar) throw new Error(errGuardar.message);
      setDocumentos(nuevos);
      if (anterior) await supabase.storage.from(BUCKET_DOCENTES).remove([anterior]);
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se pudo subir el documento: " + (err as Error).message });
    }
    setSubiendo(null);
  }

  function cambiarTitulo(i: number, campo: "titulo" | "institucion" | "anio", valor: string) {
    setTitulos(titulos.map((t, n) => (n === i ? { ...t, [campo]: valor } : t)));
  }

  function agregarTitulo() {
    setTitulos([...titulos, { titulo: "", institucion: "", anio: "", path: null, nombre: null }]);
  }

  async function subirArchivoTitulo(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const ext = extensionDe(archivo.name);
    const esImagen = archivo.type.startsWith("image/");
    if (!esImagen && ext !== "pdf") {
      setMensaje({ tipo: "error", texto: "El título tiene que ser una foto o un PDF." });
      return;
    }
    if (!esImagen && archivo.size > MAX_BYTES_ARCHIVO) {
      setMensaje({ tipo: "error", texto: "El PDF pesa más de 10 MB. Sacale una foto al título." });
      return;
    }
    setSubiendo(`titulo-${i}`);
    setMensaje(null);
    try {
      let cuerpo: Blob = archivo;
      let nombre = archivo.name;
      let tipoMime = mimeDe(archivo.name) ?? "application/pdf";
      if (esImagen) {
        const comp = await comprimirImagen(archivo);
        cuerpo = comp.blob;
        nombre = comp.nombre;
        tipoMime = "image/jpeg";
      }
      const path = `${uid}/legajo/titulo-${Date.now()}-${nombreSeguro(nombre)}`;
      const { error } = await supabase.storage.from(BUCKET_DOCENTES).upload(path, cuerpo, { contentType: tipoMime });
      if (error) throw new Error(error.message);

      const anterior = titulos[i]?.path ?? null;
      const nuevos = titulos.map((t, n) => (n === i ? { ...t, path, nombre } : t));
      const errGuardar = await persistir({ titulos: nuevos });
      if (errGuardar) throw new Error(errGuardar.message);
      setTitulos(nuevos);
      if (anterior) await supabase.storage.from(BUCKET_DOCENTES).remove([anterior]);
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se pudo subir el archivo: " + (err as Error).message });
    }
    setSubiendo(null);
  }

  async function quitarTitulo(i: number) {
    const t = titulos[i];
    if (!t) return;
    if (!window.confirm("¿Quitar este título?")) return;
    const nuevos = titulos.filter((_, n) => n !== i);
    const errGuardar = await persistir({ titulos: nuevos });
    if (errGuardar) {
      setMensaje({ tipo: "error", texto: "No se pudo quitar: " + errGuardar.message });
      return;
    }
    setTitulos(nuevos);
    if (t.path) await supabase.storage.from(BUCKET_DOCENTES).remove([t.path]);
  }

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (!data?.signedUrl) {
      ventana?.close();
      setMensaje({ tipo: "error", texto: "No se pudo abrir el archivo." });
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  function faltantes(): string[] {
    const lista: string[] = [];
    [...CAMPOS_PERSONALES, ...CAMPOS_PROFESIONALES, ...CAMPOS_EMERGENCIA].forEach((c) => {
      if (!c.opcional && form[c.k].trim() === "") lista.push(c.label);
    });
    if (!fotoPath) lista.push("Foto tipo carnet");
    if (titulos.length === 0 || titulos.some((t) => !t.titulo.trim() || !t.path)) {
      lista.push("Títulos (cada uno con su nombre y su archivo adjunto)");
    }
    DOCUMENTOS_PERSONAL.forEach((d) => {
      if (!documentos[d.clave]) lista.push(d.label);
    });
    if (asignaciones.length === 0) lista.push("Qué enseño (al menos una materia)");
    return lista;
  }

  async function guardar(enviar: boolean) {
    setMensaje(null);
    if (enviar || enviado) {
      const faltan = faltantes();
      if (faltan.length > 0) {
        setMensaje({ tipo: "error", texto: "Todavía falta completar: " + faltan.join(", ") + "." });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    setGuardando(true);
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    const horas = parseInt(form.horas_catedra, 10);
    const datos: Record<string, unknown> = {
      nombres: texto(form.nombres),
      apellidos: texto(form.apellidos),
      ci: texto(form.ci),
      fecha_nacimiento: texto(form.fecha_nacimiento),
      lugar_nacimiento: texto(form.lugar_nacimiento),
      estado_civil: texto(form.estado_civil),
      nacionalidad: texto(form.nacionalidad),
      domicilio: texto(form.domicilio),
      telefono: texto(form.telefono),
      telefono2: texto(form.telefono2),
      correo: texto(form.correo),
      matricula: texto(form.matricula),
      fecha_ingreso: texto(form.fecha_ingreso),
      cargo: texto(form.cargo),
      situacion: texto(form.situacion),
      horas_catedra: Number.isNaN(horas) ? null : horas,
      emergencia_nombre: texto(form.emergencia_nombre),
      emergencia_telefono: texto(form.emergencia_telefono),
      capacitaciones: texto(form.capacitaciones),
      experiencia: texto(form.experiencia),
      titulos,
      asignaciones,
      documentos,
      foto_path: fotoPath,
    };
    if (enviar && !enviado) {
      datos.enviado = true;
      datos.enviado_en = new Date().toISOString();
    }
    const error = await persistir(datos);
    setGuardando(false);
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo guardar: " + error.message });
      return;
    }
    if (enviar && !enviado) {
      setEnviado(true);
      setEnviadoEn(new Date().toISOString());
      setMensaje({ tipo: "ok", texto: "¡Legajo enviado! Gracias." });
    } else {
      setMensaje({ tipo: "ok", texto: enviado ? "Cambios guardados." : "Borrador guardado. Podés seguir después." });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCampo(c: Campo) {
    const etiqueta = (
      <>
        {c.label}
        {c.opcional ? <span className="text-text-soft font-normal"> (opcional)</span> : <span className="text-danger"> *</span>}
      </>
    );
    const comun = {
      value: form[c.k],
    };
    return (
      <label key={c.k} className={`flex flex-col gap-1.5 text-[13px] font-medium ${c.tipo === "textarea" ? "md:col-span-2" : ""}`}>
        <span>{etiqueta}</span>
        {c.tipo === "select" ? (
          <select {...comun} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })} className={ESTILO_INPUT}>
            <option value="">Elegir…</option>
            {c.opciones?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : c.tipo === "textarea" ? (
          <textarea
            {...comun}
            rows={3}
            onChange={(e) => setForm({ ...form, [c.k]: e.target.value })}
            className="rounded-lg border border-border p-3 text-sm bg-bg focus:outline-none focus:border-teal"
          />
        ) : (
          <input
            {...comun}
            type={c.tipo ?? "text"}
            onChange={(e) => setForm({ ...form, [c.k]: e.target.value })}
            className={ESTILO_INPUT}
          />
        )}
      </label>
    );
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  const tarjeta = "bg-card border border-border rounded-xl p-5 flex flex-col gap-4";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Mi legajo</h1>
        <p className="text-sm text-text-soft mt-1">
          Completá todos los datos marcados con <span className="text-danger">*</span> y tocá <b>Enviar legajo</b>. Podés
          guardar a medias y seguir después.
        </p>
      </div>

      {enviado && (
        <div className="text-sm rounded-lg px-3 py-2 border text-teal bg-green-50 border-green-200">
          Legajo enviado
          {enviadoEn ? ` el ${new Date(enviadoEn).toLocaleDateString("es-PY")}` : ""}. Si algún dato cambia, podés
          actualizarlo acá.
        </div>
      )}

      {mensaje && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            mensaje.tipo === "ok" ? "text-teal bg-green-50 border-green-200" : "text-danger bg-red-50 border-red-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <section className={tarjeta}>
        <h2 className="font-semibold">Foto tipo carnet <span className="text-danger">*</span></h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-28 h-36 rounded-lg border border-border bg-bg overflow-hidden flex items-center justify-center text-[11px] text-text-soft text-center">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto privada con URL firmada
              <img src={fotoUrl} alt="Foto del docente" className="w-full h-full object-cover" />
            ) : (
              "Sin foto"
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="h-10 rounded-lg border border-border px-4 flex items-center text-sm font-medium cursor-pointer bg-bg">
              Elegir una foto
              <input type="file" accept="image/*" onChange={subirFoto} className="hidden" />
            </label>
            <label className="h-10 rounded-lg border border-border px-4 flex items-center text-sm font-medium cursor-pointer bg-bg">
              Sacarme una selfie
              <input type="file" accept="image/*" capture="user" onChange={subirFoto} className="hidden" />
            </label>
            {subiendo === "foto" && <span className="text-xs text-text-soft">Subiendo…</span>}
          </div>
        </div>
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">Datos personales</h2>
        <div className="grid md:grid-cols-2 gap-4">{CAMPOS_PERSONALES.map(renderCampo)}</div>
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">Datos en el colegio</h2>
        <div className="grid md:grid-cols-2 gap-4">{CAMPOS_PROFESIONALES.map(renderCampo)}</div>
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">
          Qué enseño <span className="text-danger">*</span>
        </h2>
        <p className="text-xs text-text-soft">
          Elegí año, turno, curso y materia, y tocá <b>Agregar</b>. Repetí por cada materia que dictás.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <select value={ciclo} onChange={(e) => cambiarCiclo(e.target.value)} className={ESTILO_INPUT}>
            <option value="">Año lectivo…</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={turno} onChange={(e) => cambiarTurno(e.target.value)} className={ESTILO_INPUT} disabled={!ciclo}>
            <option value="">Turno…</option>
            {turnos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={cursoId} onChange={(e) => cambiarCurso(e.target.value)} className={ESTILO_INPUT} disabled={!turno}>
            <option value="">Curso…</option>
            {cursosFiltrados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grado}
                {c.enfasis ? ` — ${c.enfasis}` : ""}
              </option>
            ))}
          </select>
          <select
            value={disciplinaId}
            onChange={(e) => setDisciplinaId(e.target.value)}
            className={ESTILO_INPUT}
            disabled={!cursoId}
          >
            <option value="">Materia…</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={agregarAsignacion}
          disabled={!disciplinaId}
          className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 self-start disabled:opacity-50"
        >
          + Agregar
        </button>

        {asignaciones.length > 0 && (
          <div className="flex flex-col divide-y divide-border border border-border rounded-lg">
            {asignaciones.map((a, i) => (
              <div key={`${a.curso_id}-${a.disciplina_id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{a.materia}</div>
                  <div className="text-xs text-text-soft">
                    {a.grado}
                    {a.enfasis ? ` — ${a.enfasis}` : ""} · Turno {a.turno} · {a.ciclo}
                  </div>
                </div>
                <button type="button" onClick={() => quitarAsignacion(i)} className="text-xs text-danger font-medium">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">
          Títulos obtenidos <span className="text-danger">*</span>
        </h2>
        <p className="text-xs text-text-soft">
          Agregá cada título con su nombre y adjuntá una foto o un PDF (máximo 10 MB).
        </p>
        {titulos.map((t, i) => (
          <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-3">
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={t.titulo}
                onChange={(e) => cambiarTitulo(i, "titulo", e.target.value)}
                placeholder="Título (ej.: Licenciatura en Matemática)"
                className={`${ESTILO_INPUT} md:col-span-3`}
              />
              <input
                value={t.institucion}
                onChange={(e) => cambiarTitulo(i, "institucion", e.target.value)}
                placeholder="Institución"
                className={`${ESTILO_INPUT} md:col-span-2`}
              />
              <input
                value={t.anio}
                onChange={(e) => cambiarTitulo(i, "anio", e.target.value)}
                placeholder="Año"
                inputMode="numeric"
                className={ESTILO_INPUT}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="h-9 rounded-lg border border-border px-3.5 flex items-center text-[13px] font-medium cursor-pointer bg-bg">
                {t.path ? "Cambiar archivo" : "Adjuntar archivo"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => subirArchivoTitulo(i, e)}
                  className="hidden"
                />
              </label>
              {subiendo === `titulo-${i}` && <span className="text-xs text-text-soft">Subiendo…</span>}
              {t.path && subiendo !== `titulo-${i}` && (
                <button type="button" onClick={() => abrirArchivo(t.path as string)} className="text-xs text-navy font-medium">
                  Ver archivo ({t.nombre})
                </button>
              )}
              <button type="button" onClick={() => quitarTitulo(i)} className="text-xs text-danger font-medium ml-auto">
                Quitar título
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={agregarTitulo}
          className="h-10 rounded-lg border border-border bg-bg font-semibold text-sm px-5 self-start"
        >
          + Agregar título
        </button>
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">Documentos del personal</h2>
        <p className="text-xs text-text-soft">
          Los tres son obligatorios. Se guardan como PDF (máximo 10 MB). Si sacás fotos, se juntan solas en un PDF.
        </p>
        {DOCUMENTOS_PERSONAL.map((d) => {
          const actual = documentos[d.clave];
          return (
            <div key={d.clave} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="text-[13px] font-medium">
                {d.label} <span className="text-danger">*</span>
              </div>
              <div className="text-xs text-text-soft">{d.ayuda}</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="h-9 rounded-lg border border-border px-3.5 flex items-center text-[13px] font-medium cursor-pointer bg-bg">
                  {actual ? "Cambiar archivo" : "Adjuntar"}
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => subirDocumento(d.clave, e)}
                    className="hidden"
                  />
                </label>
                {subiendo === `doc-${d.clave}` && <span className="text-xs text-text-soft">Subiendo…</span>}
                {actual && subiendo !== `doc-${d.clave}` && (
                  <button type="button" onClick={() => abrirArchivo(actual.path)} className="text-xs text-navy font-medium">
                    Ver archivo ({actual.nombre})
                  </button>
                )}
                {!actual && <span className="text-xs text-danger">Falta adjuntar</span>}
              </div>
            </div>
          );
        })}
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">Contacto de emergencia</h2>
        <div className="grid md:grid-cols-2 gap-4">{CAMPOS_EMERGENCIA.map(renderCampo)}</div>
      </section>

      <section className={tarjeta}>
        <h2 className="font-semibold">Otros datos</h2>
        <div className="grid md:grid-cols-2 gap-4">{CAMPOS_EXTRA.map(renderCampo)}</div>
      </section>

      <div className="flex flex-wrap gap-3 pb-8">
        {!enviado && (
          <button
            type="button"
            onClick={() => guardar(false)}
            disabled={guardando}
            className="h-11 rounded-lg border border-border bg-bg font-semibold text-sm px-6 disabled:opacity-60"
          >
            Guardar borrador
          </button>
        )}
        <button
          type="button"
          onClick={() => guardar(true)}
          disabled={guardando}
          className="h-11 rounded-lg bg-navy text-white font-semibold text-sm px-6 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : enviado ? "Guardar cambios" : "Enviar legajo"}
        </button>
      </div>
    </div>
  );
}
