import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { STORAGE_KEYS } from "@/constants";

type BackendResponseBody = {
  success?: boolean;
  data?: unknown;
  message?: unknown;
  error?: unknown;
  errors?: unknown;
};

const DEFAULT_UPLOAD_ERROR_MESSAGE = "تعذر رفع صورة المنتج";

const getReadableMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedMessage = getReadableMessage(item);
      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      getReadableMessage(record.message) ||
      getReadableMessage(record.error) ||
      getReadableMessage(record.errors)
    );
  }

  return null;
};

const parseBackendResponseBody = async (
  response: Response,
): Promise<BackendResponseBody> => {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return { message: text };
  }

  try {
    return (await response.json()) as BackendResponseBody;
  } catch {
    return {};
  }
};

export const proxyProductMultipartRequest = async ({
  request,
  route,
  method,
}: {
  request: Request;
  route: string;
  method: "POST" | "PATCH";
}) => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return NextResponse.json(
      {
        success: false,
        message: "API base URL is not configured",
      },
      { status: 500 },
    );
  }

  const accessToken = (await cookies()).get(STORAGE_KEYS.ACCESS_TOKEN)?.value;
  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/${route.replace(/^\//, "")}`,
      {
        method,
        body: formData,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken.replace(/['"]+/g, "")}`,
        },
      },
    );
    const responseBody = await parseBackendResponseBody(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            getReadableMessage(responseBody) ||
            response.statusText ||
            DEFAULT_UPLOAD_ERROR_MESSAGE,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      data:
        responseBody &&
        typeof responseBody === "object" &&
        "data" in responseBody
          ? responseBody.data
          : responseBody,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : DEFAULT_UPLOAD_ERROR_MESSAGE,
      },
      { status: 500 },
    );
  }
};
