-- CNMRA · Plataforma digital — disciplinas (materias) por curso
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 0001_init.sql.
-- Lista real tomada de los horarios de clases vigentes del colegio (2026).
-- Conecta esa lista a Registro anecdótico y Calificaciones.

-- ========== TABLA DISCIPLINAS ==========
create table if not exists disciplinas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  creado_en timestamptz not null default now(),
  unique (curso_id, nombre)
);

comment on table disciplinas is 'Materias dictadas en cada curso (turno + grado + énfasis). Editable desde Cursos.';

create index if not exists idx_disciplinas_curso on disciplinas(curso_id);

alter table disciplinas enable row level security;

create policy "disciplinas_lectura" on disciplinas for select using (auth.role() = 'authenticated');
create policy "disciplinas_gestion_institucional" on disciplinas for all using (es_institucional()) with check (es_institucional());

-- ========== CONECTAR A REGISTRO ANECDÓTICO ==========
-- Nullable: un registro puede ser general (ej. conducta) o de una disciplina puntual.
alter table registros_anecdoticos
  add column if not exists disciplina_id uuid references disciplinas(id) on delete set null;

create index if not exists idx_registros_disciplina on registros_anecdoticos(disciplina_id);

-- ========== CONECTAR A CALIFICACIONES ==========
alter table calificaciones
  add column if not exists disciplina_id uuid references disciplinas(id) on delete set null;

-- La columna "materia" (texto libre) queda en desuso a favor de disciplina_id.
alter table calificaciones alter column materia drop not null;

-- Reemplazar la restricción única: ahora es por disciplina, no por texto libre.
alter table calificaciones drop constraint if exists calificaciones_estudiante_id_materia_etapa_key;
create unique index if not exists calificaciones_estudiante_disciplina_etapa_key
  on calificaciones(estudiante_id, disciplina_id, etapa);

-- ========== DATOS INICIALES: disciplinas reales por curso (horario 2026) ==========

-- Tercer Ciclo EEB (7°, 8°, 9° — turno tarde): misma lista de materias en los 3 grados
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Castellano', 1),
  ('Guaraní', 2),
  ('Matemática', 3),
  ('Ciencias Naturales', 4),
  ('Historia y Geografía', 5),
  ('Ética', 6),
  ('Artes', 7),
  ('Música', 8),
  ('Educación Física', 9),
  ('Salud', 10),
  ('Desarrollo Personal', 11),
  ('Trabajo y Tecnología', 12)
) as d(nombre, orden)
where c.ciclo = 'Tercer Ciclo EEB'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Básicas — Mañana, 1° Curso
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Matemática', 1),
  ('Ciencias Naturales', 2),
  ('Psicología', 3),
  ('Geología', 4),
  ('Guaraní', 5),
  ('Educación Física', 6),
  ('Literatura', 7),
  ('Artes', 8),
  ('Historia y Geografía', 9),
  ('Lógica Matemática', 10),
  ('Antropología Social', 11),
  ('Educación Ambiental', 12)
) as d(nombre, orden)
where c.turno = 'mañana' and c.enfasis = 'Ciencias Básicas' and c.grado = '1° Curso'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Básicas — Mañana, 2° Curso
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Literatura', 1),
  ('Matemática', 2),
  ('Física', 3),
  ('Guaraní', 4),
  ('Artes', 5),
  ('Historia y Geografía', 6),
  ('Ciencias Naturales', 7),
  ('Orientación', 8),
  ('Estadística', 9),
  ('Filosofía', 10),
  ('Ética', 11),
  ('Química', 12),
  ('Educación Física', 13),
  ('Inglés', 14)
) as d(nombre, orden)
where c.turno = 'mañana' and c.enfasis = 'Ciencias Básicas' and c.grado = '2° Curso'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Básicas — Mañana, 3° Curso
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Literatura', 1),
  ('Historia y Geografía', 2),
  ('Química', 3),
  ('Inglés', 4),
  ('Biología', 5),
  ('Orientación', 6),
  ('Física', 7),
  ('Educación Física', 8),
  ('Plan Optativo', 9),
  ('Guaraní', 10),
  ('Matemática', 11),
  ('Economía', 12),
  ('Física Laboratorio', 13),
  ('Química Laboratorio', 14)
) as d(nombre, orden)
where c.turno = 'mañana' and c.enfasis = 'Ciencias Básicas' and c.grado = '3° Curso'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Sociales, 1° Curso — igual en turno mañana y tarde
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Educación Vial', 1),
  ('Literatura', 2),
  ('Antropología Cultural', 3),
  ('Matemática', 4),
  ('Educación Física', 5),
  ('Artes', 6),
  ('Inglés', 7),
  ('Ciencias Naturales', 8),
  ('Psicología', 9),
  ('Antropología Social', 10),
  ('Estadística', 11),
  ('Historia', 12)
) as d(nombre, orden)
where c.enfasis = 'Ciencias Sociales' and c.grado = '1° Curso'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Sociales, 2° Curso — igual en turno mañana y tarde
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Ciencias Naturales', 1),
  ('Investigación Social', 2),
  ('Matemática', 3),
  ('Física', 4),
  ('Educación Física', 5),
  ('Ética', 6),
  ('Guaraní', 7),
  ('Historia', 8),
  ('Orientación', 9),
  ('Artes', 10),
  ('Literatura', 11),
  ('Química', 12),
  ('Inglés', 13),
  ('Filosofía', 14)
) as d(nombre, orden)
where c.enfasis = 'Ciencias Sociales' and c.grado = '2° Curso'
on conflict (curso_id, nombre) do nothing;

-- Ciencias Sociales, 3° Curso — igual en turno mañana y tarde
insert into disciplinas (curso_id, nombre, orden)
select c.id, d.nombre, d.orden
from cursos c
cross join (values
  ('Química', 1),
  ('Sociología', 2),
  ('Educación Física', 3),
  ('Literatura', 4),
  ('Política', 5),
  ('Física', 6),
  ('Economía', 7),
  ('Orientación', 8),
  ('Plan Optativo', 9),
  ('Historia', 10),
  ('Educación Financiera', 11),
  ('Inglés', 12),
  ('Matemática', 13),
  ('Guaraní', 14)
) as d(nombre, orden)
where c.enfasis = 'Ciencias Sociales' and c.grado = '3° Curso'
on conflict (curso_id, nombre) do nothing;
