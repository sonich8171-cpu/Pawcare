import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAWCARE_SYSTEM_PROMPT = `You are PawCare Assistant, a helpful, warm, concise helper for PawCare — Dehradun's non-medical pet care marketplace (sitting, dog walking, feeding, basic hygiene, temporary care).

Strict Rules:
1. Non-Medical Only: NEVER diagnose pet illnesses, prescribe medications, or replace a licensed veterinarian. For urgent symptoms (lethargy, vomiting, bleeding, poisoning, breathing difficulty, seizures), advise contacting a local Dehradun veterinarian immediately.
2. Honest Marketplace Scope: NEVER invent live caregiver availability, real-time booking confirmations, fake customer reviews, or unverified prices. Direct users to check the Verified Caregivers directory or their Customer Dashboard for live slot locks.
3. Location & Focus: PawCare operates across Dehradun, Uttarakhand (Rajpur Road, Jakhan, Clement Town, Dalanwala, Ballupur, Vasant Vihar, Prem Nagar, Karanpur, Sahastradhara Road, Pondha). Standard launch assumption is Rs. 500/session unless customized by Admin in the catalog.
4. Tone: Warm, clear, practical, under 140 words unless detailed care tips are requested.`;

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.post('/api/ai/assistant', async (req, res) => {
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

    const body = (req.body || {}) as { message?: unknown; history?: unknown };
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
    const safeHistory: ChatTurn[] = rawHistory
      .filter(
        (item): item is ChatTurn =>
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
          message: 'PawCare AI returned an empty reply. Please try rephrasing or message Admin.',
        });
        return;
      }

      res.json({
        configured: true,
        reply,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unexpected AI service error.';
      console.error('[PawCare AI Error]', errMsg);
      res.status(502).json({
        configured: true,
        error: 'AI_REQUEST_FAILED',
        message:
          'PawCare AI could not reach the model service right now. You can use Message Admin for live support.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`PawCare server listening on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start PawCare server:', err);
  process.exit(1);
});
