-- ============================================================
-- EL CUCHITRIL DE WALL Y EVA
-- Esquema inicial de ventas
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Extensiones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. Tipos ENUM
-- ============================================================

CREATE TYPE public.tipo_pago AS ENUM (
  'completo',
  'parcial'
);

CREATE TYPE public.estado_venta AS ENUM (
  'pendiente',
  'pagado',
  'cancelado'
);

CREATE TYPE public.metodo_pago AS ENUM (
  'efectivo',
  'transferencia',
  'otro'
);

-- ============================================================
-- 3. Secuencia y función para generar folios
-- ============================================================

CREATE SEQUENCE public.ventas_folio_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.generar_folio()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'CW-' || LPAD(nextval('public.ventas_folio_seq')::text, 4, '0');
$$;

-- Solo el dueño puede leer y modificar datos. Si hay un único usuario
-- en Auth, se reconoce automáticamente; con varios, registra su UUID
-- en private.app_owner desde el SQL Editor.
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

-- ============================================================
-- 4. Tabla ventas
-- ============================================================

CREATE TABLE public.ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text UNIQUE NOT NULL DEFAULT public.generar_folio(),
  fecha timestamptz NOT NULL DEFAULT now(),
  cliente_nombre text NOT NULL,
  cliente_telefono text NOT NULL,
  tipo_pago public.tipo_pago NOT NULL,
  estado public.estado_venta NOT NULL DEFAULT 'pendiente',
  total numeric(10, 2) NOT NULL CHECK (total > 0),
  notas text
);

-- ============================================================
-- 5. Tabla venta_items
-- ============================================================

CREATE TABLE public.venta_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL
    REFERENCES public.ventas(id)
    ON DELETE CASCADE,
  producto_nombre text NOT NULL,
  descripcion text,
  precio numeric(10, 2) NOT NULL CHECK (precio > 0)
);

-- ============================================================
-- 6. Tabla pagos
-- ============================================================

CREATE TABLE public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id),
  monto numeric(10, 2) NOT NULL CHECK (monto > 0),
  fecha timestamptz NOT NULL DEFAULT now(),
  metodo public.metodo_pago NOT NULL DEFAULT 'efectivo',
  nota text
);

-- ============================================================
-- 7. Índices
-- ============================================================

CREATE INDEX ventas_estado_idx
  ON public.ventas (estado);

CREATE INDEX ventas_cliente_telefono_idx
  ON public.ventas (cliente_telefono);

CREATE INDEX ventas_fecha_idx
  ON public.ventas (fecha);

CREATE INDEX venta_items_venta_id_idx
  ON public.venta_items (venta_id);

CREATE INDEX pagos_venta_id_idx
  ON public.pagos (venta_id);

CREATE INDEX venta_items_producto_nombre_idx
  ON public.venta_items (producto_nombre);

-- ============================================================
-- 8. Vista saldo_por_venta
-- ============================================================

CREATE OR REPLACE VIEW public.saldo_por_venta AS
SELECT
  v.*,
  COALESCE(SUM(p.monto), 0)::numeric(10, 2) AS pagado,
  GREATEST(
    v.total - COALESCE(SUM(p.monto), 0),
    0
  )::numeric(10, 2) AS saldo
FROM public.ventas AS v
LEFT JOIN public.pagos AS p
  ON p.venta_id = v.id
GROUP BY v.id;

ALTER VIEW public.saldo_por_venta SET (security_invoker = true);

-- ============================================================
-- 9. Vista por_cobrar
-- ============================================================

CREATE OR REPLACE VIEW public.por_cobrar AS
SELECT *
FROM public.saldo_por_venta
WHERE estado = 'pendiente'
  AND saldo > 0
ORDER BY fecha ASC;

ALTER VIEW public.por_cobrar SET (security_invoker = true);

-- ============================================================
-- 10. Función crear_venta
-- ============================================================

CREATE OR REPLACE FUNCTION public.crear_venta(
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_tipo_pago public.tipo_pago,
  p_items jsonb,
  p_pago_inicial numeric,
  p_metodo_pago public.metodo_pago,
  p_notas text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_venta_id uuid;
  v_total numeric(10, 2) := 0;
  v_pago_inicial numeric(10, 2) := COALESCE(p_pago_inicial, 0);
  v_item jsonb;
  v_producto_nombre text;
  v_precio numeric(10, 2);
BEGIN
  IF NOT private.es_dueno() THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;

  IF p_cliente_nombre IS NULL
     OR trim(p_cliente_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  IF p_cliente_telefono IS NULL
     OR trim(p_cliente_telefono) = '' THEN
    RAISE EXCEPTION 'El teléfono del cliente es obligatorio';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un ítem';
  END IF;

  IF v_pago_inicial < 0 THEN
    RAISE EXCEPTION 'El pago inicial no puede ser negativo';
  END IF;

  -- Calcula el total en el backend, sin confiar en el cliente.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS items(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada ítem debe ser un objeto JSON';
    END IF;

    v_producto_nombre := NULLIF(
      trim(v_item->>'producto_nombre'),
      ''
    );

    IF v_producto_nombre IS NULL THEN
      RAISE EXCEPTION 'Cada ítem debe tener producto_nombre';
    END IF;

    IF NULLIF(trim(v_item->>'precio'), '') IS NULL THEN
      RAISE EXCEPTION 'Cada ítem debe tener precio';
    END IF;

    BEGIN
      v_precio := (v_item->>'precio')::numeric(10, 2);
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION
          'El precio de un ítem no es válido: %',
          v_item->>'precio';
    END;

    IF v_precio <= 0 THEN
      RAISE EXCEPTION 'Todos los precios deben ser mayores que cero';
    END IF;

    v_total := v_total + v_precio;
  END LOOP;

  v_total := round(v_total, 2);

  IF v_pago_inicial > v_total THEN
    RAISE EXCEPTION
      'El pago inicial no puede ser mayor que el total de la venta';
  END IF;

  INSERT INTO public.ventas (
    cliente_nombre,
    cliente_telefono,
    tipo_pago,
    estado,
    total,
    notas
  )
  VALUES (
    trim(p_cliente_nombre),
    trim(p_cliente_telefono),
    p_tipo_pago,
    CASE
      WHEN p_tipo_pago = 'completo' THEN 'pagado'::public.estado_venta
      ELSE 'pendiente'::public.estado_venta
    END,
    v_total,
    p_notas
  )
  RETURNING id INTO v_venta_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS items(value)
  LOOP
    INSERT INTO public.venta_items (
      venta_id,
      producto_nombre,
      descripcion,
      precio
    )
    VALUES (
      v_venta_id,
      trim(v_item->>'producto_nombre'),
      NULLIF(trim(v_item->>'descripcion'), ''),
      (v_item->>'precio')::numeric(10, 2)
    );
  END LOOP;

  IF p_tipo_pago = 'completo' THEN
    INSERT INTO public.pagos (
      venta_id,
      monto,
      metodo,
      nota
    )
    VALUES (
      v_venta_id,
      v_total,
      p_metodo_pago,
      'Pago completo'
    );
  ELSIF p_tipo_pago = 'parcial'
        AND v_pago_inicial > 0 THEN
    INSERT INTO public.pagos (
      venta_id,
      monto,
      metodo,
      nota
    )
    VALUES (
      v_venta_id,
      v_pago_inicial,
      p_metodo_pago,
      NULL
    );
  END IF;

  RETURN v_venta_id;
END;
$$;

-- ============================================================
-- 11. Función agregar_pago
-- ============================================================

CREATE OR REPLACE FUNCTION public.agregar_pago(
  p_venta_id uuid,
  p_monto numeric,
  p_metodo public.metodo_pago,
  p_nota text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_venta;
  v_total numeric(10, 2);
  v_pagado numeric(10, 2);
  v_saldo numeric(10, 2);
BEGIN
  IF NOT private.es_dueno() THEN
    RAISE EXCEPTION 'No tienes permiso para registrar pagos';
  END IF;

  IF p_monto IS NULL OR round(p_monto, 2) <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor que cero';
  END IF;

  SELECT estado, total
  INTO v_estado, v_total
  FROM public.ventas
  WHERE id = p_venta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION
      'Solo se pueden agregar pagos a ventas pendientes';
  END IF;

  SELECT COALESCE(SUM(monto), 0)
  INTO v_pagado
  FROM public.pagos
  WHERE venta_id = p_venta_id;

  v_saldo := round(v_total - v_pagado, 2);

  IF round(p_monto, 2) > v_saldo THEN
    RAISE EXCEPTION
      'El pago no puede ser mayor que el saldo pendiente';
  END IF;

  INSERT INTO public.pagos (
    venta_id,
    monto,
    metodo,
    nota
  )
  VALUES (
    p_venta_id,
    round(p_monto, 2),
    p_metodo,
    p_nota
  );

  IF v_saldo - round(p_monto, 2) = 0 THEN
    UPDATE public.ventas
    SET estado = 'pagado'
    WHERE id = p_venta_id;
  END IF;
END;
$$;

-- ============================================================
-- 12. Función cancelar_venta
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancelar_venta(
  p_venta_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.es_dueno() THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar ventas';
  END IF;

  UPDATE public.ventas
  SET estado = 'cancelado'
  WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe';
  END IF;
END;
$$;

-- ============================================================
-- 13. Row Level Security
-- ============================================================

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden consultar ventas"
ON public.ventas
FOR SELECT
TO authenticated
USING (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden crear ventas"
ON public.ventas
FOR INSERT
TO authenticated
WITH CHECK (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden actualizar ventas"
ON public.ventas
FOR UPDATE
TO authenticated
USING (private.es_dueno())
WITH CHECK (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden consultar items"
ON public.venta_items
FOR SELECT
TO authenticated
USING (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden crear items"
ON public.venta_items
FOR INSERT
TO authenticated
WITH CHECK (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden actualizar items"
ON public.venta_items
FOR UPDATE
TO authenticated
USING (private.es_dueno())
WITH CHECK (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden consultar pagos"
ON public.pagos
FOR SELECT
TO authenticated
USING (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden crear pagos"
ON public.pagos
FOR INSERT
TO authenticated
WITH CHECK (private.es_dueno());

CREATE POLICY "Usuarios autenticados pueden actualizar pagos"
ON public.pagos
FOR UPDATE
TO authenticated
USING (private.es_dueno())
WITH CHECK (private.es_dueno());

-- No se crean políticas DELETE: no se permite borrar físicamente.

-- Las escrituras pasan únicamente por RPC: los clientes no pueden
-- alterar montos, pagos o estados directamente.
REVOKE INSERT, UPDATE, DELETE ON public.ventas, public.venta_items, public.pagos FROM authenticated, anon;
REVOKE ALL ON public.ventas, public.venta_items, public.pagos FROM anon;
REVOKE ALL ON public.saldo_por_venta, public.por_cobrar FROM anon;

GRANT SELECT
ON public.ventas
TO authenticated;

GRANT SELECT
ON public.venta_items
TO authenticated;

GRANT SELECT
ON public.pagos
TO authenticated;

GRANT SELECT
ON public.saldo_por_venta
TO authenticated;

GRANT SELECT
ON public.por_cobrar
TO authenticated;

REVOKE ALL ON FUNCTION public.crear_venta(
  text,
  text,
  public.tipo_pago,
  jsonb,
  numeric,
  public.metodo_pago,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.crear_venta(
  text,
  text,
  public.tipo_pago,
  jsonb,
  numeric,
  public.metodo_pago,
  text
) TO authenticated;

REVOKE ALL ON FUNCTION public.agregar_pago(
  uuid,
  numeric,
  public.metodo_pago,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.agregar_pago(
  uuid,
  numeric,
  public.metodo_pago,
  text
) TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_venta(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.generar_folio() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancelar_venta(uuid)
TO authenticated;

REVOKE USAGE, SELECT
ON SEQUENCE public.ventas_folio_seq
FROM authenticated, anon;

COMMIT;

-- ============================================================
-- 14. Datos de prueba opcionales
-- Descomenta este bloque solo si deseas insertar ejemplos.
-- ============================================================

/*
DO $$
DECLARE
  v_venta_1 uuid;
  v_venta_2 uuid;
BEGIN
  v_venta_1 := public.crear_venta(
    'Ana Pérez',
    '5551234567',
    'parcial',
    '[
      {
        "producto_nombre": "WALL-E edición especial",
        "descripcion": "Figura articulada",
        "precio": 35.00
      },
      {
        "producto_nombre": "Eva colección Pixar",
        "descripcion": "Figura de colección",
        "precio": 25.00
      }
    ]'::jsonb,
    20.00,
    'transferencia',
    'Entrega en punto acordado'
  );

  v_venta_2 := public.crear_venta(
    'Carlos López',
    '5559876543',
    'completo',
    '[
      {
        "producto_nombre": "Robot vintage",
        "descripcion": "Figura retro",
        "precio": 50.00
      }
    ]'::jsonb,
    0,
    'efectivo',
    'Venta de prueba pagada'
  );

  PERFORM public.agregar_pago(
    v_venta_1,
    40.00,
    'efectivo',
    'Pago final'
  );
END;
$$;
*/
