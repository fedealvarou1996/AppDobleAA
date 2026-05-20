# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Invitaciones de jugadores

La app incluye un flujo de invitacion desde la ficha admin del jugador:

- boton `Invitar jugador` en la ficha individual
- Edge Function `invite-player`
- vinculacion automatica de `players.user_id`
- upsert de `profiles.role = 'player'`

Pasos para activarlo en Supabase:

1. Ejecutar [supabase/player-invite-setup.sql](./supabase/player-invite-setup.sql) en el SQL Editor.
2. Desplegar la function:

```bash
supabase functions deploy invite-player
```

3. Si queres controlar adonde llega el link del email, definir el secreto opcional:

```bash
supabase secrets set PLAYER_INVITE_REDIRECT_TO=https://tu-app.com/login
```

La function usa los secretos estandar del proyecto:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Registro de jugadores

La app tambien incluye un registro directo para jugadores en `/register`.

Ese flujo:

- crea el usuario en Supabase Auth
- inserta `profiles.role = 'player'`
- inserta la ficha inicial en `players`

Para que funcione con RLS, ejecuta tambien [supabase/player-invite-setup.sql](./supabase/player-invite-setup.sql) actualizado.

## Pagos online con Mercado Pago (Checkout Pro)

Se agrego un flujo basico de pago online desde `/my-profile`:

- boton `Pagar cuota con Mercado Pago` para jugador
- Edge Function `create-mercadopago-checkout` para crear preferencia
- Edge Function `mercadopago-webhook` para confirmar pagos
- registro del historial en `player_payments` cuando el estado llega `approved`

Pasos para activarlo:

1. Ejecutar [supabase/mercadopago-checkout-setup.sql](./supabase/mercadopago-checkout-setup.sql).
2. Desplegar funciones:

```bash
supabase functions deploy create-mercadopago-checkout
supabase functions deploy mercadopago-webhook
```

3. Definir secretos:

```bash
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
supabase secrets set APP_BASE_URL=https://tu-app.com
supabase secrets set MERCADOPAGO_WEBHOOK_URL=https://<project-ref>.functions.supabase.co/mercadopago-webhook
```

4. En el frontend, definir variable de entorno:

```bash
VITE_MONTHLY_FEE_ARS=15000
```

Notas:

- La confirmacion real del pago se hace por webhook (no por redireccion del navegador).
- `MERCADOPAGO_WEBHOOK_URL` es opcional, pero recomendado para tener confirmacion automatica.
