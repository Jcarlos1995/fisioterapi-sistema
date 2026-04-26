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

interface CancellationNotification {
  patientName: string;
  patientDni: string;
  therapyType: string;
  date: string;
  time: string;
  professionalName: string;
  reason?: string;
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

async function sendCancellationWhatsAppNotification(
  data: CancellationNotification
): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    console.warn("CALLMEBOT_API_KEY no configurada — notificación de cancelación omitida.");
    return;
  }

  const mensaje =
    `⚠️ *CANCELACIÓN*\n\n` +
    `👤 *Paciente:* ${data.patientName} (DNI ${data.patientDni})\n` +
    `🩺 *Cita:* ${data.therapyType}\n` +
    `📅 *Fecha:* ${data.date} ${data.time}\n` +
    `👨‍⚕️ *Profesional:* ${data.professionalName}\n` +
    `📝 *Motivo:* ${data.reason?.trim() || "No especificado"}`;

  const url =
    `https://api.callmebot.com/whatsapp.php` +
    `?phone=${CLINIC_WHATSAPP}` +
    `&text=${encodeURIComponent(mensaje)}` +
    `&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("CallMeBot cancelación error:", res.status, await res.text());
    } else {
      console.log("WhatsApp de cancelación enviado correctamente a la clínica.");
    }
  } catch (err) {
    console.error("Error de conexión con CallMeBot (cancelación):", err);
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

async function checkIpRateLimitInCollection(
  ip: string,
  collectionName: string
): Promise<void> {
  const ref = db.collection(collectionName).doc(ip.replace(/[:.]/g, "_"));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    const { count, windowStart } = snap.data() as { count: number; windowStart: number };
    if (now - windowStart > HOUR_MS) {
      tx.set(ref, { count: 1, windowStart: now });
    } else if (count >= MAX_PER_HOUR) {
      throw new HttpsError(
        "resource-exhausted",
        "Demasiados intentos. Por favor espera una hora e intenta de nuevo."
      );
    } else {
      tx.update(ref, { count: count + 1 });
    }
  });
}

function parseSessionDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

interface ValidatePatientLoginInput {
  dni: string;
  birthDate: string;
}

interface GetPatientAppointmentsInput {
  patientId: string;
  dni: string;
}

interface PatientSession {
  id: string;
  date?: string;
  time?: string;
  [key: string]: unknown;
}

interface CancelPatientBookingInput {
  sessionId: string;
  patientDni: string;
  patientBirthDate: string;
  reason?: string;
}

export const validatePatientLogin = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 15,
    cors: true,
  },
  async (request) => {
    const ip = request.rawRequest.ip ?? "unknown";
    await checkIpRateLimitInCollection(ip, "patientLoginRateLimits");

    const { dni, birthDate } = request.data as ValidatePatientLoginInput;
    const cleanDni = (dni || "").trim().toUpperCase();
    const cleanBirthDate = (birthDate || "").trim();

    if (!cleanDni || !cleanBirthDate) {
      throw new HttpsError("invalid-argument", "Datos de acceso incompletos.");
    }

    const patientSnap = await db
      .collection("patients")
      .where("dni", "==", cleanDni)
      .limit(1)
      .get();

    if (patientSnap.empty) {
      throw new HttpsError("not-found", "No se encontró el paciente.");
    }

    const patientDoc = patientSnap.docs[0];
    const patient = patientDoc.data() as {
      name?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
    };

    if (!patient.birthDate || patient.birthDate !== cleanBirthDate) {
      throw new HttpsError("not-found", "No se encontró el paciente.");
    }

    return {
      patient: {
        id: patientDoc.id,
        name: patient.name ?? "",
        phone: patient.phone ?? "",
        email: patient.email ?? "",
        birthDate: patient.birthDate,
      },
    };
  }
);

export const getPatientAppointments = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 15,
    cors: true,
  },
  async (request) => {
    const { patientId, dni } = request.data as GetPatientAppointmentsInput;
    const cleanPatientId = (patientId || "").trim();
    const cleanDni = (dni || "").trim().toUpperCase();

    if (!cleanPatientId || !cleanDni) {
      throw new HttpsError("invalid-argument", "Datos de consulta incompletos.");
    }

    const patientRef = db.collection("patients").doc(cleanPatientId);
    const patientSnap = await patientRef.get();

    if (!patientSnap.exists) {
      throw new HttpsError("not-found", "Paciente no encontrado.");
    }

    const patient = patientSnap.data() as { dni?: string };
    if ((patient.dni || "").trim().toUpperCase() !== cleanDni) {
      throw new HttpsError("permission-denied", "No autorizado para consultar estas citas.");
    }

    const sessionsSnap = await db
      .collection("sessions")
      .where("patientId", "==", cleanPatientId)
      .get();

    const sessions: PatientSession[] = sessionsSnap.docs
      .map<PatientSession>((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const aDate = `${String(a.date || "")}T${String(a.time || "")}:00`;
        const bDate = `${String(b.date || "")}T${String(b.time || "")}:00`;
        return aDate.localeCompare(bDate);
      });

    return { sessions };
  }
);

export const cancelPatientBooking = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    cors: true,
    secrets: ["CALLMEBOT_API_KEY"],
  },
  async (request) => {
    const { sessionId, patientDni, patientBirthDate, reason } =
      request.data as CancelPatientBookingInput;

    const cleanSessionId = (sessionId || "").trim();
    const cleanPatientDni = (patientDni || "").trim().toUpperCase();
    const cleanPatientBirthDate = (patientBirthDate || "").trim();
    const cleanReason = typeof reason === "string" ? reason.trim() : "";

    if (!cleanSessionId || !cleanPatientDni || !cleanPatientBirthDate) {
      throw new HttpsError("invalid-argument", "Datos de cancelación incompletos.");
    }

    const sessionRef = db.collection("sessions").doc(cleanSessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", "No se encontró la cita.");
    }

    const sessionData = sessionSnap.data() as {
      patientId?: string;
      professionalId?: string;
      date?: string;
      time?: string;
      therapyType?: string;
      status?: string;
    };

    if (!sessionData.patientId) {
      throw new HttpsError("failed-precondition", "La cita no tiene paciente asociado.");
    }

    const patientRef = db.collection("patients").doc(sessionData.patientId);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) {
      throw new HttpsError("not-found", "No se encontró el paciente de la cita.");
    }

    const patientData = patientSnap.data() as {
      name?: string;
      dni?: string;
      birthDate?: string;
    };

    const storedDni = (patientData.dni || "").trim().toUpperCase();
    const storedBirthDate = (patientData.birthDate || "").trim();
    if (storedDni !== cleanPatientDni || storedBirthDate !== cleanPatientBirthDate) {
      throw new HttpsError("permission-denied", "No autorizado para cancelar esta cita.");
    }

    if (sessionData.status !== "Programada" && sessionData.status !== "Confirmada") {
      throw new HttpsError("failed-precondition", "Esta cita no se puede cancelar.");
    }

    const appointmentDate = parseSessionDateTime(sessionData.date || "", sessionData.time || "");
    if (!appointmentDate) {
      throw new HttpsError("failed-precondition", "La fecha/hora de la cita es inválida.");
    }

    const now = Date.now();
    const diffMs = appointmentDate.getTime() - now;
    const minAdvanceMs = 2 * 60 * 60 * 1000;
    if (diffMs < minAdvanceMs) {
      throw new HttpsError(
        "failed-precondition",
        "Las cancelaciones requieren mínimo 2 horas de anticipación."
      );
    }

    const professionalId = sessionData.professionalId || "";
    let professionalName = "No asignado";
    if (professionalId) {
      const professionalSnap = await db.collection("professionals").doc(professionalId).get();
      if (professionalSnap.exists) {
        const professionalData = professionalSnap.data() as { name?: string };
        professionalName = professionalData.name || "No asignado";
      }
    }

    await sessionRef.update({ status: "Cancelada" });

    await db.collection("cancellationNotifications").add({
      sessionId: cleanSessionId,
      patientId: sessionData.patientId,
      patientName: patientData.name || "",
      patientDni: cleanPatientDni,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      sessionDate: sessionData.date || "",
      sessionTime: sessionData.time || "",
      therapyType: sessionData.therapyType || "",
      professionalId,
      read: false,
      reason: cleanReason || null,
    });

    sendCancellationWhatsAppNotification({
      patientName: patientData.name || "",
      patientDni: cleanPatientDni,
      therapyType: sessionData.therapyType || "",
      date: sessionData.date || "",
      time: sessionData.time || "",
      professionalName,
      reason: cleanReason,
    }).catch((err) => console.error("sendCancellationWhatsAppNotification inesperado:", err));

    return { success: true };
  }
);
