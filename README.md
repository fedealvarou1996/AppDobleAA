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
