-- CNMRA · Plataforma digital — esquema inicial
-- Basado en el prototipo aprobado. Ejecutar en el SQL Editor de Supabase.

-- ========== EXTENSIONES ==========
create extension if not exists "pgcrypto";

-- ========== PERFILES DE USUARIO ==========
-- Cada persona que puede iniciar sesión (director, equipo de carga de datos, tutores/familias)
-- está vinculada 1 a 1 con auth.users a través de este perfil.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null check (rol in ('director', 'carga_datos', 'familia')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table perfiles is 'Un registro por persona con acceso a la plataforma. rol define qué puede hacer.';

-- ========== ESTRUCTURA ACADÉMICA ==========
create table if not exists cursos (
  id uuid primary key default gen_random_uuid(),
  turno text not null check (turno in ('mañana', 'tarde', 'noche')),
  ciclo text not null, -- 'Tercer Ciclo EEB' | 'Bachillerato Científico'
  enfasis text,         -- 'Ciencias Básicas' | 'Ciencias Sociales' | null (tercer ciclo no tiene énfasis)
  grado text not null,  -- '7°','8°','9°','1° Curso','2° Curso','3° Curso'
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists secciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  nombre text not null, -- 'A', 'B'...
  unique (curso_id, nombre)
);

-- ========== FAMILIAS Y ESTUDIANTES ==========
create table if not exists familias (
  id uuid primary key default gen_random_uuid(),
  tutor_perfil_id uuid references perfiles(id) on delete set null,
  tutor_nombre text not null,
  tutor_cedula text not null unique,
  tutor_parentesco text,
  tutor_telefono text,
  tutor_email text,
  tutor_direccion text,
  creado_en timestamptz not null default now()
);

create table if not exists estudiantes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  nombre_completo text not null,
  fecha_nacimiento date,
  seccion_id uuid references secciones(id),
  ciclo_lectivo int not null default extract(year from now()),
  estado text not null default 'activo' check (estado in ('activo', 'egresado', 'baja')),
  creado_en timestamptz not null default now()
);

-- ========== INSCRIPCIÓN ==========
create table if not exists inscripciones (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  curso_solicitado_id uuid references cursos(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  enviado_por uuid references perfiles(id),
  revisado_por uuid references perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ========== ACUERDO DE CONVIVENCIA ==========
create table if not exists acuerdos (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  ciclo_lectivo int not null default extract(year from now()),
  firmado boolean not null default false,
  firmado_por_nombre text,
  firmado_en timestamptz,
  unique (estudiante_id, ciclo_lectivo)
);

-- ========== REGISTRO ANECDÓTICO ==========
create table if not exists registros_anecdoticos (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  fecha date not null default current_date,
  categoria text not null check (categoria in ('positivo', 'atencion', 'conducta')),
  descripcion text not null,
  cargado_por uuid references perfiles(id),
  visible_familia boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ========== ASISTENCIA ==========
create table if not exists asistencias (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  fecha date not null default current_date,
  estado text not null check (estado in ('presente', 'ausente', 'tardanza', 'justificado')),
  observacion text,
  cargado_por uuid references perfiles(id),
  creado_en timestamptz not null default now(),
  unique (estudiante_id, fecha)
);

-- ========== CALIFICACIONES ==========
create table if not exists calificaciones (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  materia text not null,
  etapa int not null check (etapa in (1, 2, 3)),
  nota numeric(4,1),
  observacion text,
  cargado_por uuid references perfiles(id),
  creado_en timestamptz not null default now(),
  unique (estudiante_id, materia, etapa)
);

-- ========== ALERTAS ==========
create table if not exists alertas (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  tipo text not null check (tipo in ('inasistencia', 'academica', 'conducta', 'acuerdo_pendiente', 'otro')),
  severidad text not null default 'media' check (severidad in ('baja', 'media', 'alta')),
  mensaje text not null,
  leida_por_familia boolean not null default false,
  creado_por uuid references perfiles(id),
  creado_en timestamptz not null default now()
);

-- ========== ÍNDICES ==========
create index if not exists idx_estudiantes_familia on estudiantes(familia_id);
create index if not exists idx_estudiantes_seccion on estudiantes(seccion_id);
create index if not exists idx_asistencias_estudiante on asistencias(estudiante_id);
create index if not exists idx_calificaciones_estudiante on calificaciones(estudiante_id);
create index if not exists idx_alertas_estudiante on alertas(estudiante_id);
create index if not exists idx_registros_estudiante on registros_anecdoticos(estudiante_id);

-- ========== SEGURIDAD (RLS) ==========
alter table perfiles enable row level security;
alter table familias enable row level security;
alter table estudiantes enable row level security;
alter table inscripciones enable row level security;
alter table acuerdos enable row level security;
alter table registros_anecdoticos enable row level security;
alter table asistencias enable row level security;
alter table calificaciones enable row level security;
alter table alertas enable row level security;
alter table cursos enable row level security;
alter table secciones enable row level security;

-- Función auxiliar: ¿el usuario logueado es personal institucional (director o carga_datos)?
create or replace function es_institucional()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid()
      and rol in ('director', 'carga_datos')
      and activo = true
  );
$$;

-- Cursos y secciones: todos los usuarios autenticados pueden leer (para selectores)
create policy "cursos_lectura" on cursos for select using (auth.role() = 'authenticated');
create policy "secciones_lectura" on secciones for select using (auth.role() = 'authenticated');
create policy "cursos_gestion_institucional" on cursos for all using (es_institucional()) with check (es_institucional());
create policy "secciones_gestion_institucional" on secciones for all using (es_institucional()) with check (es_institucional());

-- Perfiles: cada quien ve el suyo; institucional ve todos
create policy "perfiles_propio" on perfiles for select using (id = auth.uid() or es_institucional());
create policy "perfiles_gestion_institucional" on perfiles for all using (es_institucional()) with check (es_institucional());
-- Una persona nueva (familia) puede crear su propio perfil, pero solo con rol 'familia' —
-- nunca puede auto-asignarse director o carga_datos desde el formulario público.
create policy "perfiles_autoregistro_familia" on perfiles for insert with check (
  id = auth.uid() and rol = 'familia'
);

-- Familias: institucional ve todas; el tutor solo la suya
create policy "familias_institucional" on familias for all using (es_institucional()) with check (es_institucional());
create policy "familias_propia" on familias for select using (tutor_perfil_id = auth.uid());
-- Autoinscripción: una persona con perfil 'familia' puede crear su propia familia
create policy "familias_autoregistro" on familias for insert with check (tutor_perfil_id = auth.uid());

-- Estudiantes: institucional ve todos; familia solo los suyos
create policy "estudiantes_institucional" on estudiantes for all using (es_institucional()) with check (es_institucional());
create policy "estudiantes_propia_familia" on estudiantes for select using (
  familia_id in (select id from familias where tutor_perfil_id = auth.uid())
);
-- Autoinscripción: una familia puede agregar hijos a su propia familia (nueva o ya existente)
create policy "estudiantes_autoregistro" on estudiantes for insert with check (
  familia_id in (select id from familias where tutor_perfil_id = auth.uid())
);

-- Registros / asistencia / calificaciones / alertas / acuerdos / inscripciones:
-- mismo patrón — institucional gestiona todo, familia solo lee lo de sus hijos.
create policy "inscripciones_institucional" on inscripciones for all using (es_institucional()) with check (es_institucional());
create policy "inscripciones_propia_familia" on inscripciones for select using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);
create policy "inscripciones_autoregistro" on inscripciones for insert with check (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

create policy "acuerdos_institucional" on acuerdos for all using (es_institucional()) with check (es_institucional());
create policy "acuerdos_propia_familia" on acuerdos for select using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);
create policy "acuerdos_firma_familia" on acuerdos for update using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
) with check (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

create policy "registros_institucional" on registros_anecdoticos for all using (es_institucional()) with check (es_institucional());
create policy "registros_propia_familia" on registros_anecdoticos for select using (
  visible_familia = true and estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

create policy "asistencias_institucional" on asistencias for all using (es_institucional()) with check (es_institucional());
create policy "asistencias_propia_familia" on asistencias for select using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

create policy "calificaciones_institucional" on calificaciones for all using (es_institucional()) with check (es_institucional());
create policy "calificaciones_propia_familia" on calificaciones for select using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

create policy "alertas_institucional" on alertas for all using (es_institucional()) with check (es_institucional());
create policy "alertas_propia_familia" on alertas for select using (
  estudiante_id in (select e.id from estudiantes e join familias f on f.id = e.familia_id where f.tutor_perfil_id = auth.uid())
);

-- ========== DATOS INICIALES: estructura académica real (PEI 2026-2030) ==========
-- Turno Mañana
insert into cursos (turno, ciclo, enfasis, grado, orden) values
 ('mañana','Bachillerato Científico','Ciencias Básicas','1° Curso',1),
 ('mañana','Bachillerato Científico','Ciencias Básicas','2° Curso',2),
 ('mañana','Bachillerato Científico','Ciencias Básicas','3° Curso',3),
 ('mañana','Bachillerato Científico','Ciencias Sociales','1° Curso',4),
 ('mañana','Bachillerato Científico','Ciencias Sociales','2° Curso',5),
 ('mañana','Bachillerato Científico','Ciencias Sociales','3° Curso',6),
-- Turno Tarde
 ('tarde','Tercer Ciclo EEB',null,'7°',7),
 ('tarde','Tercer Ciclo EEB',null,'8°',8),
 ('tarde','Tercer Ciclo EEB',null,'9°',9),
 ('tarde','Bachillerato Científico','Ciencias Sociales','1° Curso',10),
 ('tarde','Bachillerato Científico','Ciencias Sociales','2° Curso',11),
 ('tarde','Bachillerato Científico','Ciencias Sociales','3° Curso',12)
on conflict do nothing;

-- Secciones A/B para cada curso recién creado (ajustable luego desde la plataforma)
insert into secciones (curso_id, nombre)
select id, 'A' from cursos
on conflict do nothing;

insert into secciones (curso_id, nombre)
select id, 'B' from cursos
where grado in ('1° Curso','2° Curso','7°','8°','9°')
on conflict do nothing;
