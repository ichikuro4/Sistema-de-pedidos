# El cuchitril de WALL y Eva

Sistema de ventas de figuritas con Next.js, Supabase Auth y PostgreSQL.

## URL

- Local: [http://localhost:3000/login](http://localhost:3000/login)
- Producción: **pendiente de registrar**. Después del despliegue, copia aquí la URL que aparece en **Vercel → Project → Domains**. El repositorio aún no tiene un proyecto de Vercel enlazado.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y configura la URL y la clave **publishable** del proyecto de Supabase:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-publishable
   ```

2. Si la base es nueva, ejecuta [supabase/schema.sql](supabase/schema.sql) en el SQL Editor. Si ya contiene ventas, aplica **solo** [supabase/security-hardening.sql](supabase/security-hardening.sql); no vuelvas a ejecutar el esquema inicial.
3. En **Authentication → Users**, crea el usuario del dueño. El sistema no tiene registro público.
4. Ejecuta `npm install`, `npm run dev` y abre la URL local. Para comprobar la compilación, usa `npm run build`.

### Seguridad de la base existente

Después de aplicar el endurecimiento, ejecuta [supabase/security-audit.sql](supabase/security-audit.sql) en el SQL Editor. Debe mostrar RLS activa en `ventas`, `venta_items` y `pagos`; `security_invoker=true` en las dos vistas; ninguna función de escritura ejecutable por `anon`; y ningún permiso directo de `INSERT`, `UPDATE` o `DELETE` para `authenticated` en esas tablas.

Si Supabase Auth tiene **un solo usuario**, ese usuario es el dueño. Si tiene varios, registra el UUID correcto después de aplicar el script:

```sql
INSERT INTO private.app_owner (user_id)
VALUES ('UUID-DEL-DUEÑO')
ON CONFLICT (user_id) DO NOTHING;
```

Hasta configurar ese UUID, el acceso queda cerrado para todos los usuarios autenticados. No compartas la clave secreta o `service_role` con el navegador. Las funciones `SECURITY DEFINER` del esquema comprueban el dueño y usan `search_path` vacío. [Supabase explica estos controles](https://supabase.com/docs/guides/database/functions).

## Despliegue en Vercel

1. Publica el repositorio e impórtalo en Vercel como proyecto Next.js.
2. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en **Settings → Environment Variables** para Production y, si se usa, Preview. Los cambios en variables requieren un nuevo despliegue.
3. Ejecuta un despliegue y comprueba `/login`, `/ventas` y una venta de prueba con el usuario del dueño. Registra la URL final en la sección **URL** de este README.
4. En Supabase **Authentication → URL Configuration**, usa la URL de producción como **Site URL**.
5. Confirma en Supabase que se aplicó el script de seguridad de la base existente; el despliegue de Next.js no ejecuta SQL automáticamente.

La compilación local verifica que Next.js pueda generar la aplicación. La disponibilidad de Vercel y la base de producción debe comprobarse después del despliegue. [Documentación de variables de Vercel](https://vercel.com/docs/environment-variables).

El proyecto incluye manifest e iconos para añadirlo a la pantalla de inicio del celular. La instalación requiere servirlo por HTTPS; no hay modo sin conexión.

## Respaldos y exportación

En **Reportes**, selecciona el rango completo que quieras conservar y descarga **Exportar ventas a CSV** y **Exportar pagos a CSV**. Guarda ambos archivos fuera de la aplicación. Los CSV son útiles para consulta en Excel, pero **no son un respaldo completo**: no incluyen todos los ítems ni la configuración de Auth.

Para un respaldo íntegro usa **Database → Backups** en Supabase cuando el plan lo permita, o el comando de [Supabase CLI `db dump`](https://supabase.com/docs/guides/platform/backups). Comprueba periódicamente que puedes restaurar el respaldo.

## Cambiar la contraseña

El panel no tiene formulario de cambio de contraseña. El administrador del proyecto puede actualizar la contraseña del usuario mediante la [Auth Admin API `updateUserById`](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) desde un entorno de confianza con la clave secreta; nunca desde el navegador ni con una variable `NEXT_PUBLIC_*`. Supabase también documenta el flujo de [restablecimiento por correo](https://supabase.com/docs/guides/auth/passwords), que requiere una página de cambio de contraseña y URL de redirección configuradas antes de usarlo.
