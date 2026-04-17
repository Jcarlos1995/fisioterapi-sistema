import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Proxy seguro para Gemini.
 * La clave API vive en el servidor (functions/.env) — el cliente solo manda el prompt.
 *
 * Request:  { prompt: string, model?: string }
 * Response: { text: string }
 */
export const geminiProxy = onCall(
  {
    region:         "us-central1",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para usar el análisis IA.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError("internal", "Clave Gemini no configurada en el servidor.");
    }

    const { prompt, model = "gemini-2.5-flash" } = request.data as {
      prompt: string;
      model?: string;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new HttpsError("invalid-argument", "El campo 'prompt' es requerido.");
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const genAI       = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });
        const result      = await geminiModel.generateContent(prompt);
        return { text: result.response.text() };
      } catch (err: unknown) {
        lastError = err;
        const msg = String((err as { message?: string })?.message ?? "");
        const isTransient = msg.includes("503") || msg.includes("429");
        if (isTransient && attempt < 3) {
          await new Promise((res) => setTimeout(res, attempt * 2000));
          continue;
        }
        break;
      }
    }

    const errorMsg = String((lastError as { message?: string })?.message ?? "");
    if (errorMsg.includes("503"))
      throw new HttpsError("unavailable", "Servicio IA con alta demanda. Intenta en unos segundos.");
    if (errorMsg.includes("429"))
      throw new HttpsError("resource-exhausted", "Límite de IA alcanzado. Intenta en unos minutos.");

    throw new HttpsError("internal", "Error al contactar el servicio IA.");
  }
);
