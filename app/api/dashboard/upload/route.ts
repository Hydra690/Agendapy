import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireUserId } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

// Subida de imágenes (logo / portada) a Vercel Blob. El resultado es una URL pública
// que se guarda en Business.logoUrl / coverUrl (campos que siguen siendo URLs).
//
// Honestidad de señal: si el storage no está configurado (falta BLOB_READ_WRITE_TOKEN)
// el endpoint responde 503 con un mensaje claro, NUNCA finge una subida exitosa. El
// dashboard mantiene el fallback de pegar una URL manual.

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const u = await requireUserId();
  if ("response" in u) return u.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "La subida de imágenes no está configurada. Pegá una URL por ahora." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo inválido (se espera multipart/form-data)" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Usá JPG, PNG o WEBP." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera el máximo de 2 MB." }, { status: 400 });
  }

  try {
    const ext = EXT_BY_TYPE[file.type];
    const blob = await put(`business/${u.userId}/${Date.now()}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    logError("[upload]", error);
    return NextResponse.json(
      { error: "No se pudo subir la imagen. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
