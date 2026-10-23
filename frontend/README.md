# NETWORTH frontend

React-интерфейс собирается Vite и использует React Router и Recharts.

```bash
npm install
npm run dev
```

Во время разработки Vite открывает приложение на `http://localhost:5173` и перенаправляет `/api` на Express по адресу `http://localhost:3000`.

Production-сборка:

```bash
npm run build
npm run preview
```

Результат находится в `dist`. В полном проекте эту папку автоматически раздаёт Express; основные инструкции находятся в корневом `README.md`.
