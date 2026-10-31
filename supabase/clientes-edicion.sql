-- Ejecutar en Supabase SQL Editor DESPUÉS de clientes-migration.sql.
-- Permite editar una ficha sin dar permisos directos de escritura a la app.
BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS editado_manualmente boolean NOT NULL DEFAULT false;

-- Una venta nueva conserva los datos de una ficha corregida manualmente.
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
    SET nombre = CASE WHEN clientes.editado_manualmente THEN clientes.nombre ELSE EXCLUDED.nombre END,
        telefono = CASE WHEN clientes.editado_manualmente THEN clientes.telefono ELSE EXCLUDED.telefono END
  RETURNING id INTO NEW.cliente_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.asociar_cliente_venta() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_cliente(
  p_cliente_id uuid,
  p_nombre text,
  p_telefono text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text := nullif(trim(p_nombre), '');
  v_telefono text := nullif(trim(p_telefono), '');
BEGIN
  IF NOT private.es_dueno() THEN
    RAISE EXCEPTION 'No tienes permiso para editar clientes';
  END IF;

  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'El cliente no existe';
  END IF;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  IF v_telefono IS NULL THEN
    RAISE EXCEPTION 'El teléfono del cliente es obligatorio';
  END IF;

  UPDATE public.clientes
  SET nombre = v_nombre,
      telefono = v_telefono,
      telefono_clave = private.clave_telefono(v_telefono),
      editado_manualmente = true
  WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente no existe';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Ese teléfono ya pertenece a otro cliente';
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_cliente(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_cliente(uuid, text, text) TO authenticated;

COMMIT;
