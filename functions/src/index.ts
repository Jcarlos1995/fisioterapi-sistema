import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ─── Notificación WhatsApp vía CallMeBot ──────────────────────────────────────
const CLINIC_WHATSAPP = "51926798464"; // +51 926 798 464

interface BookingNotification {
  name:        string;
  phone:       string;
  dni:         string;
  therapyType: string;
  date:        string;
  time:        string;
}

async function sendWhatsAppNotification(data: BookingNotification): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    console.warn("CALLMEBOT_API_KEY no configurada — notificación WhatsApp omitida.");
    return;
  }

  // Formatear fecha legible en español (Lima)
  let fechaLegible = data.date;
  try {
    fechaLegible = new Date(`${data.date}T${data.time}:00`)
      .toLocaleDateString("es-PE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        timeZone: "America/Lima",
      });
  } catch { /* si falla el formato, usa la fecha raw */ }

  const mensaje =
    `🏥 *Nueva cita registrada*\n\n` +
    `👤 *Paciente:* ${data.name}\n` +
    `🪪 *DNI:* ${data.dni}\n` +
    `📞 *Teléfono:* ${data.phone}\n` +
    `🩺 *Terapia:* ${data.therapyType}\n` +
    `📅 *Fecha:* ${fechaLegible}\n` +
    `⏰ *Hora:* ${data.time}\n\n` +
    `_Registro automático vía web_`;

  const url =
    `https://api.callmebot.com/whatsapp.php` +
    `?phone=${CLINIC_WHATSAPP}` +
    `&text=${encodeURIComponent(mensaje)}` +
    `&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("CallMeBot error:", res.status, await res.text());
    } else {
      console.log("WhatsApp enviado correctamente a la clínica.");
    }
  } catch (err) {
    // No bloqueamos la reserva si falla el WhatsApp
    console.error("Error de conexión con CallMeBot:", err);
  }
}

export const geminiProxy = onRequest(
  { region: "us-central1", timeoutSeconds: 60 },
  async (req, res) => {
    // ── CORS explícito ────────────────────────────────────────────────────────
    res.set("Access-Control-Allow-Origin",  "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") { res.status(204).end(); return; }

    // ── Autenticación manual por Bearer token ─────────────────────────────────
    const authHeader = req.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Debes iniciar sesión para usar el análisis IA." });
      return;
    }
    try {
      await admin.auth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: "Token inválido o expirado." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Clave Gemini no configurada en el servidor." });
      return;
    }

    const { prompt, model = "gemini-2.5-flash" } = req.body as {
      prompt: string;
      model?: string;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({ error: "El campo 'prompt' es requerido." });
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const genAI       = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });
        const result      = await geminiModel.generateContent(prompt);
        res.json({ text: result.response.text() });
        return;
      } catch (err: unknown) {
        lastError = err;
        const msg = String((err as { message?: string })?.message ?? "");
        const isTransient = msg.includes("503") || msg.includes("429");
        if (isTransient && attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
          continue;
        }
        break;
      }
    }

    const errorMsg = String((lastError as { message?: string })?.message ?? "");
    if (errorMsg.includes("503"))
      res.status(503).json({ error: "Servicio IA con alta demanda. Intenta en unos segundos." });
    else if (errorMsg.includes("429"))
      res.status(429).json({ error: "Límite de IA alcanzado. Intenta en unos minutos." });
    else
      res.status(500).json({ error: "Error al contactar el servicio IA." });
  }
);

// ─── Rate limit: máx 5 intentos por IP por hora ───────────────────────────
const MAX_PER_HOUR = 5;
const HOUR_MS      = 60 * 60 * 1000;

async function checkIpRateLimit(ip: string): Promise<void> {
  const ref = db.collection("bookingRateLimits").doc(ip.replace(/[:.]/g, "_"));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now  = Date.now();
    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    const { count, windowStart } = snap.data() as { count: number; windowStart: number };
    if (now - windowStart > HOUR_MS) {
      tx.set(ref, { count: 1, windowStart: now });
    } else if (count >= MAX_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "Demasiados intentos. Por favor espera una hora e intenta de nuevo.");
    } else {
      tx.update(ref, { count: count + 1 });
    }
  });
}

interface BookingInput {
  name:        string;
  phone:       string;
  email:       string;
  dni:         string;
  age:         string;
  therapyType: string;
  startStr:    string;
  endStr:      string;
}

export const getAvailability = onCall(
  {
    region:         "us-central1",
    timeoutSeconds: 15,
    cors:           true,
  },
  async () => {
    // Solo traemos citas activas (Programada / Confirmada) para que los slots
    // de sesiones ya "Efectuadas" o "Pagadas" (pasadas) no bloqueen el calendario.
    const snap = await db.collection("sessions")
      .where("status", "in", ["Programada", "Confirmada"])
      .select("date", "time", "endDate", "therapyType")
      .get();

    const slots = snap.docs.map(d => {
      const data = d.data();
      // Algunas sesiones guardan solo "date" (YYYY-MM-DD) + "time" (HH:mm).
      // Otras guardan "date" en formato ISO completo. Normalizamos:
      const rawDate = data.date ?? "";
      const rawTime = data.time ?? "";
      const hasTimeInDate = rawDate.includes("T");
      const start = hasTimeInDate ? rawDate : (rawTime ? `${rawDate}T${rawTime}:00` : rawDate);

      return {
        start,
        end:         data.endDate ?? start,
        therapyType: data.therapyType ?? "",
      };
    });

    return { slots };
  }
);

export const createBooking = onCall(
  {
    region:         "us-central1",
    timeoutSeconds: 30,
    cors:           true,
    secrets:        ["CALLMEBOT_API_KEY"],
  },
  async (request) => {
    // Rate limit por IP
    const ip = request.rawRequest.ip ?? "unknown";
    await checkIpRateLimit(ip);

    const { name, phone, email, dni, age, therapyType, startStr, endStr } =
      request.data as BookingInput;

    // Validación básica de campos requeridos
    if (!name?.trim() || !phone?.trim() || !email?.trim() || !dni?.trim() || !startStr) {
      throw new HttpsError("invalid-argument", "Todos los campos son obligatorios.");
    }

    const cleanDni = dni.trim().toUpperCase();

    // Buscar paciente por DNI
    const patientSnap = await db
      .collection("patients")
      .where("dni", "==", cleanDni)
      .limit(1)
      .get();

    let patientId: string;

    if (!patientSnap.empty) {
      patientId = patientSnap.docs[0].id;

      // Verificar si ya tiene una cita pendiente (query simple por patientId)
      const existingSessions = await db
        .collection("sessions")
        .where("patientId", "==", patientId)
        .get();

      const hasPending = existingSessions.docs.some(d => {
        const s = d.data().status as string;
        return s === "Programada" || s === "Confirmada";
      });

      if (hasPending) {
        throw new HttpsError(
          "already-exists",
          "Ya tienes una cita pendiente registrada. Contacta a la clínica si necesitas modificarla."
        );
      }

      await db.collection("patients").doc(patientId).update({
        name:  name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        age:   parseInt(age) || 0,
      });
    } else {
      const newPatient = await db.collection("patients").add({
        name:           name.trim(),
        email:          email.trim(),
        phone:          phone.trim(),
        dni:            cleanDni,
        age:            parseInt(age) || 0,
        professionalId: "",
        createdAt:      new Date().toISOString(),
      });
      patientId = newPatient.id;
    }

    const sessionDate = startStr.split("T")[0];
    const sessionTime = startStr.split("T")[1]?.substring(0, 5) ?? "";

    await db.collection("sessions").add({
      patientId,
      professionalId: "",
      date:        sessionDate,
      time:        sessionTime,
      endDate:     endStr,
      therapyType,
      status:      "Programada",
      type:        "online-booking",
      notes:       `Registro web automático. DNI: ${cleanDni}`,
      createdAt:   new Date().toISOString(),
    });

    // Notificar a la clínica por WhatsApp (no bloquea si falla)
    sendWhatsAppNotification({
      name:        name.trim(),
      phone:       phone.trim(),
      dni:         cleanDni,
      therapyType,
      date:        sessionDate,
      time:        sessionTime,
    }).catch((err) => console.error("sendWhatsAppNotification inesperado:", err));

    return { success: true, patientName: name.trim() };
  }
);
