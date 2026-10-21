# NexBill Backend

Express and Prisma backend with production-oriented structure.

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Set `DATABASE_URL` to a MySQL connection string before running Prisma migrations.

## Scripts

- `npm start` - run the API.
- `npm run dev` - run the API with nodemon.
- `npm run lint` - run ESLint.
- `npm run format` - format the project with Prettier.
- `npm run prisma:generate` - generate Prisma client.
- `npm run prisma:migrate` - create/apply development migrations.
- `npm run prisma:studio` - open Prisma Studio.

## Structure

```text
src/
  config/
  controllers/
  middlewares/
  routes/
  services/
  utils/
  validators/
prisma/
```
