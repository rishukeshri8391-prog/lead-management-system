import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

function getCa(): string {
  if (process.env.DB_CA) return process.env.DB_CA;
  const p = process.env.DB_CA_PATH || "certs/ca.pem";
  return fs.readFileSync(path.join(process.cwd(), p), "utf8");
}

const globalForDb = globalThis as unknown as { pool?: mysql.Pool };

export const pool =
  globalForDb.pool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { ca: getCa() },
    waitForConnections: true,
    connectionLimit: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;