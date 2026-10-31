-- Ejecutar en Supabase SQL Editor, antes de desplegar la ficha.
-- Conserva los datos de cada venta y agrupa las compras por teléfono normalizado.
BEGIN;

-- Algunas bases creadas antes del script de seguridad no tienen este esquema.
-- Creamos sus dependencias mínimas sin tocar las ventas existentes.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_owner (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_owner_unico_idx
ON private.app_owner ((true));

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
REVOKE ALL ON TABLE private.app_owner FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.es_dueno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM private.app_owner WHERE user_id = auth.uid())
      OR (
        NOT EXISTS (SELECT 1 FROM private.app_owner)
        AND (SELECT count(*) FROM auth.users) = 1
        AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
      )
    );
$$;

REVOKE ALL ON FUNCTION private.es_dueno() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.es_dueno() TO authenticated;

CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  telefono text NOT NULL,
  telefono_clave text NOT NULL UNIQUE,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.clave_telefono(p_telefono text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g')) = 11
      AND left(regexp_replace(p_telefono, '[^0-9]', '', 'g'), 2) = '51'
      THEN right(regexp_replace(p_telefono, '[^0-9]', '', 'g'), 9)
    WHEN regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') <> ''
      THEN regexp_replace(p_telefono, '[^0-9]', '', 'g')
    ELSE lower(trim(coalesce(p_telefono, '')))
  END;
$$;

REVOKE ALL ON FUNCTION private.clave_telefono(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id);
CREATE INDEX IF NOT EXISTS ventas_cliente_id_fecha_idx ON public.ventas (cliente_id, fecha DESC);

-- El nombre visible de cada cliente proviene de su venta más reciente.
INSERT INTO public.clientes (nombre, telefono, telefono_clave)
SELECT DISTINCT ON (clave) nombre, telefono, clave
FROM (
  SELECT trim(cliente_nombre) AS nombre, trim(cliente_telefono) AS telefono,
         private.clave_telefono(cliente_telefono) AS clave, fecha, id
  FROM public.ventas
) AS historico
ORDER BY clave, fecha DESC, id DESC
ON CONFLICT (telefono_clave) DO NOTHING;

UPDATE public.ventas AS v
SET cliente_id = c.id
FROM public.clientes AS c
WHERE c.telefono_clave = private.clave_telefono(v.cliente_telefono)
  AND v.cliente_id IS DISTINCT FROM c.id;

ALTER TABLE public.ventas ALTER COLUMN cliente_id SET NOT NULL;

-- La RPC crear_venta ya valida al dueño; este disparador asocia el cliente
-- dentro de la misma transacción y evita cambiar la firma de la RPC.
CREATE OR REPLACE FUNCTION private.asociar_cliente_venta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.clientes (nombre, telefono, telefono_clave)
  VALUES (trim(NEW.cliente_nombre), trim(NEW.cliente_telefono), private.clave_telefono(NEW.cliente_telefono))
  ON CONFLICT (telefono_clave) DO UPDATE
    SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono
  RETURNING id INTO NEW.cliente_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.asociar_cliente_venta() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ventas_asociar_cliente ON public.ventas;
CREATE TRIGGER ventas_asociar_cliente
BEFORE INSERT ON public.ventas
FOR EACH ROW EXECUTE FUNCTION private.asociar_cliente_venta();

-- Añadimos cliente_id al final para conservar el orden de columnas existente.
CREATE OR REPLACE VIEW public.saldo_por_venta AS
SELECT v.id, v.folio, v.fecha, v.cliente_nombre, v.cliente_telefono,
       v.tipo_pago, v.estado, v.total, v.notas,
       COALESCE(SUM(p.monto), 0)::numeric(10, 2) AS pagado,
       GREATEST(v.total - COALESCE(SUM(p.monto), 0), 0)::numeric(10, 2) AS saldo,
       v.cliente_id
FROM public.ventas AS v
LEFT JOIN public.pagos AS p ON p.venta_id = v.id
GROUP BY v.id;
ALTER VIEW public.saldo_por_venta SET (security_invoker = true);

CREATE OR REPLACE VIEW public.por_cobrar AS
SELECT * FROM public.saldo_por_venta
WHERE estado = 'pendiente' AND saldo > 0
ORDER BY fecha ASC;
ALTER VIEW public.por_cobrar SET (security_invoker = true);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "El dueño puede consultar clientes" ON public.clientes;
CREATE POLICY "El dueño puede consultar clientes" ON public.clientes
FOR SELECT TO authenticated USING (private.es_dueno());
REVOKE ALL ON public.clientes FROM anon, authenticated;
GRANT SELECT ON public.clientes TO authenticated;
GRANT SELECT ON public.saldo_por_venta, public.por_cobrar TO authenticated;

COMMIT;
