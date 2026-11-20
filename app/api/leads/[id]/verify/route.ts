import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { VerificationStatus } from "@/types/lead";

type Ctx = { params: Promise<{ id: string }> };

interface ReputationResponse {
  email_deliverability?: {
    status?: string;
    status_detail?: string;
    is_format_valid?: boolean;
  };
  email_quality?: {
    is_disposable?: boolean;
    is_catchall?: boolean;
  };
  email_risk?: {
    address_risk_status?: string;
  };
}

function interpret(data: ReputationResponse): {
  status: VerificationStatus;
  reason: string;
} {
  const d = data.email_deliverability ?? {};
  const q = data.email_quality ?? {};
  const r = data.email_risk ?? {};
  const detail = (d.status_detail ?? "").replace(/_/g, " ");

  if (d.is_format_valid === false) {
    return { status: "invalid", reason: "Invalid email format" };
  }

  const apiStatus = (d.status ?? "").toLowerCase();

  if (apiStatus === "undeliverable") {
    return {
      status: "invalid",
      reason: detail ? `Undeliverable: ${detail}` : "Undeliverable",
    };
  }

  if (apiStatus === "deliverable") {
    const flags: string[] = [];
    if (q.is_disposable) flags.push("disposable address");
    if (q.is_catchall) flags.push("catch-all domain");
    if (r.address_risk_status === "high") flags.push("high-risk address");
    if (flags.length > 0) {
      return { status: "risky", reason: flags.join(", ") };
    }
    return { status: "valid", reason: "Mailbox verified as deliverable" };
  }

  return {
    status: "unknown",
    reason: detail || "Could not determine deliverability",
  };
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const leadId = Number(id);
    if (!Number.isInteger(leadId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const apiKey = process.env.EMAIL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Email verification is not configured" },
        { status: 500 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT email FROM leads WHERE id = ?",
      [leadId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const email = rows[0].email as string;

    const url = new URL("https://emailreputation.abstractapi.com/v1/");
    url.searchParams.set("email", email);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Abstract API error", res.status);
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Too many requests. Wait a few seconds and try again." },
          { status: 429 }
        );
      }
      if (res.status === 422) {
        return NextResponse.json(
          { error: "Verification credits are used up" },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "Email verification service error" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as ReputationResponse;
    const { status, reason } = interpret(data);

    await pool.query(
      "UPDATE leads SET verification_status = ?, verification_reason = ?, verified_at = NOW() WHERE id = ?",
      [status, reason.slice(0, 255), leadId]
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM leads WHERE id = ?",
      [leadId]
    );
    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to verify lead" }, { status: 500 });
  }
}