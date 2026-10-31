-- Datos ficticios para probar la ficha y el historial de clientes.
-- Ejecutar DESPUÉS de clientes-migration.sql en Supabase SQL Editor.
-- Es repetible: los UUID y folios fijos evitan duplicar ventas.
-- Los registros usan UUID fijos para facilitar su identificación.
BEGIN;

INSERT INTO public.ventas
  (id, folio, fecha, cliente_nombre, cliente_telefono, tipo_pago, estado, total, notas)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'CW-DEMO-001', now() - interval '18 days', 'María Quispe', '987 654 321', 'parcial', 'pendiente', 120.00, 'Venta de muestra'),
  ('11111111-1111-4111-8111-111111111102', 'CW-DEMO-002', now() - interval '9 days', 'María Quispe', '+51 987 654 321', 'completo', 'pagado', 85.00, 'Segunda compra de María'),
  ('11111111-1111-4111-8111-111111111103', 'CW-DEMO-003', now() - interval '3 days', 'María Quispe', '987654321', 'parcial', 'pendiente', 60.00, 'Tercera compra de María'),
  ('22222222-2222-4222-8222-222222222201', 'CW-DEMO-004', now() - interval '12 days', 'Luis Rojas', '912 345 678', 'completo', 'pagado', 95.00, 'Venta de muestra'),
  ('22222222-2222-4222-8222-222222222202', 'CW-DEMO-005', now() - interval '2 days', 'Luis Rojas', '912345678', 'parcial', 'pendiente', 45.00, 'Segunda compra de Luis'),
  ('33333333-3333-4333-8333-333333333301', 'CW-DEMO-006', now() - interval '25 days', 'Eva Torres', '965 432 100', 'parcial', 'cancelado', 70.00, 'Venta cancelada de muestra')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.venta_items (id, venta_id, producto_nombre, descripcion, precio)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101', '11111111-1111-4111-8111-111111111101', 'WALL-E articulado', 'Figura articulada', 75.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa102', '11111111-1111-4111-8111-111111111101', 'Eva mini', 'Figura pequeña', 45.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa103', '11111111-1111-4111-8111-111111111102', 'WALL-E explorador', 'Edición de colección', 85.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa104', '11111111-1111-4111-8111-111111111103', 'Eva luminosa', 'Figura con luz', 60.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa105', '22222222-2222-4222-8222-222222222201', 'Robot retro', 'Figura decorativa', 95.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa106', '22222222-2222-4222-8222-222222222202', 'WALL-E mini', 'Figura pequeña', 45.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa107', '33333333-3333-4333-8333-333333333301', 'Eva clásica', 'Figura de muestra', 70.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pagos (id, venta_id, monto, fecha, metodo, nota)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101', '11111111-1111-4111-8111-111111111101', 40.00, now() - interval '18 days', 'efectivo', 'Abono inicial'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102', '11111111-1111-4111-8111-111111111102', 85.00, now() - interval '9 days', 'transferencia', 'Pago completo'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103', '11111111-1111-4111-8111-111111111103', 20.00, now() - interval '3 days', 'efectivo', 'Abono inicial'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104', '22222222-2222-4222-8222-222222222201', 95.00, now() - interval '12 days', 'efectivo', 'Pago completo'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb105', '22222222-2222-4222-8222-222222222202', 15.00, now() - interval '2 days', 'transferencia', 'Abono inicial')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Resultado esperado: María 3 ventas, Luis 2 y Eva 1 cancelada.
SELECT c.nombre, c.telefono, count(*) AS ventas, sum(v.total) AS total_historico
FROM public.clientes AS c
JOIN public.ventas AS v ON v.cliente_id = c.id
WHERE v.id IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '33333333-3333-4333-8333-333333333301'
)
GROUP BY c.id, c.nombre, c.telefono
ORDER BY c.nombre;
