import { GoogleGenAI } from '@google/genai';

const PAWCARE_SYSTEM_PROMPT = `You are PawCare Assistant, a helpful, warm, concise helper for PawCare — Dehradun's non-medical pet care marketplace (sitting, dog walking, feeding, basic hygiene, temporary care).

Strict Rules:
1. Non-Medical Only: NEVER diagnose pet illnesses, prescribe medications, or replace a licensed veterinarian. For urgent symptoms (lethargy, vomiting, bleeding, poisoning, breathing difficulty, seizures), advise contacting a local Dehradun veterinarian immediately.
2. Honest Marketplace Scope: NEVER invent live caregiver availability, real-time booking confirmations, fake customer reviews, or unverified prices. Direct users to check the Verified Caregivers directory or their Customer Dashboard for live slot locks.
3. Location & Focus: PawCare operates across Dehradun, Uttarakhand (Rajpur Road, Jakhan, Clement Town, Dalanwala, Ballupur, Vasant Vihar, Prem Nagar, Karanpur, Sahastradhara Road, Pondha).
4. Tone: Warm, clear, practical, under 140 words unless detailed care tips are requested.`;

interface VercelReq {
  method?: string;
  body?: { message?: unknown; history?: unknown };
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (payload: Record<string, unknown>) => void;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      configured: false,
      error: 'AI_NOT_CONFIGURED',
      message:
        'PawCare AI is currently unavailable because GEMINI_API_KEY is not configured on the server. Use "Message Admin" for direct assistance.',
    });
    return;
  }

  const body = req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 800) {
    res.status(400).json({
      configured: true,
      error: 'INVALID_MESSAGE',
      message: 'Please enter a question between 1 and 800 characters.',
    });
    return;
  }

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const safeHistory = rawHistory
    .filter(
      (item): item is { role: 'user' | 'assistant'; text: string } =>
        Boolean(item) &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0
    )
    .map((item) => ({
      role: item.role,
      text: item.text.trim().slice(0, 600),
    }));

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const conversationText = safeHistory
      .map((turn) => `${turn.role === 'user' ? 'Pet Parent' : 'PawCare Assistant'}: ${turn.text}`)
      .join('\n');

    const prompt = conversationText
      ? `${conversationText}\nPet Parent: ${message}\nPawCare Assistant:`
      : message;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: PAWCARE_SYSTEM_PROMPT,
        maxOutputTokens: 350,
        temperature: 0.4,
      },
    });

    const reply = (response.text || '').trim();
    if (!reply) {
      res.status(502).json({
        configured: true,
        error: 'EMPTY_AI_RESPONSE',
        message: 'PawCare AI returned an empty reply.',
      });
      return;
    }

    res.json({ configured: true, reply });
  } catch (err) {
    console.error('[Vercel PawCare AI Error]', err);
    res.status(502).json({
      configured: true,
      error: 'AI_REQUEST_FAILED',
      message: 'PawCare AI could not reach the model service right now.',
    });
  }
}
