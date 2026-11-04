import { NextResponse } from "next/server";
import { loginWithCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "");
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const session = await loginWithCredentials(email, password);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: session,
      redirect: session.role === "OWNER" ? "/dashboard" : "/till",
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
