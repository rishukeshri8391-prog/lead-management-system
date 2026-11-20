import mysql from "mysql2/promise";
import fs from "fs";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8") },
});

await conn.query(`
  CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(120) NULL,
    phone VARCHAR(40) NULL,
    status ENUM('new','contacted','qualified','won','lost') NOT NULL DEFAULT 'new',
    verification_status ENUM('unverified','valid','invalid','risky','unknown') NOT NULL DEFAULT 'unverified',
    verification_reason VARCHAR(255) NULL,
    verified_at TIMESTAMP NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_email (email)
  )
`);

const [rows] = await conn.query("DESCRIBE leads");
console.table(rows);
await conn.end();
console.log("leads table is ready");