import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}/admin/${path.join("/")}`;

  try {
    const body = await req.json();
    const token = req.cookies.get("admin_access_token")?.value;

    const backendRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    const response = NextResponse.json(data, { status: backendRes.status });

    // Forward Set-Cookie header from backend if present (like for login)
    const setCookie = backendRes.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("Set-Cookie", setCookie);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}/admin/${path.join("/")}`;
  const token = req.cookies.get("admin_access_token")?.value;

  try {
    const backendRes = await fetch(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}/admin/${path.join("/")}`;
  const token = req.cookies.get("admin_access_token")?.value;

  try {
    const body = await req.json();
    const backendRes = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
