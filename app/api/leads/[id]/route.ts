import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { LEAD_STATUSES } from "@/types/lead";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const leadId = Number(id);
    if (!Number.isInteger(leadId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      fields.push("name = ?");
      values.push(name);
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
      }
      // Changing the email invalidates any earlier verification result
      fields.push(
        "email = ?",
        "verification_status = 'unverified'",
        "verification_reason = NULL",
        "verified_at = NULL"
      );
      values.push(email);
    }
    if (body.company !== undefined) {
      fields.push("company = ?");
      values.push(body.company ? String(body.company).trim() : null);
    }
    if (body.phone !== undefined) {
      fields.push("phone = ?");
      values.push(body.phone ? String(body.phone).trim() : null);
    }
    if (body.notes !== undefined) {
      fields.push("notes = ?");
      values.push(body.notes ? String(body.notes).trim() : null);
    }
    if (body.status !== undefined) {
      if (!LEAD_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      fields.push("status = ?");
      values.push(body.status);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE leads SET ${fields.join(", ")} WHERE id = ?`,
      [...values, leadId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM leads WHERE id = ?",
      [leadId]
    );
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "A lead with this email already exists" },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const leadId = Number(id);
    if (!Number.isInteger(leadId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM leads WHERE id = ?",
      [leadId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}