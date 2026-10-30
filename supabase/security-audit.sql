-- Ejecutar en Supabase SQL Editor después de security-hardening.sql.
-- Las tres tablas deben mostrar rls_activa=true.
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activa
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ventas', 'venta_items', 'pagos')
ORDER BY c.relname;

-- Las dos vistas deben mostrar security_invoker=true.
SELECT c.relname AS vista, c.reloptions
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('saldo_por_venta', 'por_cobrar')
ORDER BY c.relname;

SELECT c.relname AS vista,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_puede_leer
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('saldo_por_venta', 'por_cobrar')
ORDER BY c.relname;

-- Las funciones de escritura no deben ser ejecutables por anon;
-- su search_path debe ser vacío y las tres deben ser SECURITY DEFINER.
SELECT n.nspname AS esquema, p.proname AS funcion,
  p.prosecdef AS security_definer, p.proconfig AS configuracion,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede_ejecutar,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS autenticado_puede_ejecutar
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN ('crear_venta', 'agregar_pago', 'cancelar_venta'))
   OR (n.nspname = 'private' AND p.proname = 'es_dueno')
ORDER BY n.nspname, p.proname;

-- El cliente autenticado solo debe tener SELECT directo en las tablas.
SELECT c.relname AS tabla,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS puede_leer,
  has_table_privilege('authenticated', c.oid, 'INSERT') AS puede_insertar,
  has_table_privilege('authenticated', c.oid, 'UPDATE') AS puede_actualizar,
  has_table_privilege('authenticated', c.oid, 'DELETE') AS puede_borrar
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ventas', 'venta_items', 'pagos')
ORDER BY c.relname;

-- Todas las políticas de tablas de ventas deben llamar a private.es_dueno().
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ventas', 'venta_items', 'pagos')
ORDER BY tablename, policyname;

-- El cliente no debe poder avanzar folios directamente.
SELECT has_function_privilege('authenticated', 'public.generar_folio()', 'EXECUTE') AS puede_generar_folio,
       has_sequence_privilege('authenticated', 'public.ventas_folio_seq', 'USAGE') AS puede_usar_secuencia;

-- Con más de un usuario Auth, registra explícitamente el UUID del dueño
-- en private.app_owner; de lo contrario, el acceso se cierra por seguridad.
SELECT (SELECT count(*) FROM auth.users) AS usuarios_auth,
       (SELECT count(*) FROM private.app_owner) AS duenos_configurados;
