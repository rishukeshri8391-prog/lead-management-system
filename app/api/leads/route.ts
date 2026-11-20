import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { LEAD_STATUSES } from "@/types/lead";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM leads ORDER BY created_at DESC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const company = body.company ? String(body.company).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const status = body.status ?? "new";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!LEAD_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO leads (name, email, company, phone, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, company, phone, status, notes]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM leads WHERE id = ?",
      [result.insertId]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "A lead with this email already exists" },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}