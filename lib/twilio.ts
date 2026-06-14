const TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts";

function toWhatsAppNumber(raw: string): string {
  const stripped = raw.replace(/\s+/g, "");
  if (stripped.startsWith("whatsapp:")) return stripped;
  if (stripped.startsWith("+")) return `whatsapp:${stripped}`;
  return `whatsapp:+${stripped}`;
}

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    console.warn("[twilio] Credenciales faltantes — mensaje no enviado");
    return;
  }

  const params = new URLSearchParams({
    From: from,
    To: toWhatsAppNumber(to),
    Body: body,
  });

  const res = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio ${res.status}: ${err}`);
  }
}
