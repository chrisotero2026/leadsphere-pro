/**
 * LeadSphere Pro — Servicios Externos
 * Todas las integraciones en un solo lugar.
 * Las claves vienen del archivo .env — nunca hardcodeadas.
 */

// ══════════════════════════════════════
// TWILIO — SMS y Llamadas
// ══════════════════════════════════════
export const twilioConfig = {
  accountSid:  process.env.TWILIO_ACCOUNT_SID || '',
  authToken:   process.env.TWILIO_AUTH_TOKEN  || '',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
  get isConfigured() { return !!(this.accountSid && this.authToken); },
};

export function getTwilioClient() {
  if (!twilioConfig.isConfigured) throw new Error('Twilio no configurado. Agrega TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
  if (!twilioConfig.isConfigured) {
    console.log(`[SMS SIMULADO] Para: ${to} | Mensaje: ${body}`);
    return { success: true, sid: 'mock_' + Date.now() };
  }
  try {
    const client = getTwilioClient();
    const msg = await client.messages.create({
      body,
      from: twilioConfig.messagingServiceSid || twilioConfig.phoneNumber,
      to,
    });
    return { success: true, sid: msg.sid };
  } catch (err: any) {
    console.error('Twilio SMS error:', err.message);
    return { success: false };
  }
}

export async function makeCall(to: string, twimlUrl: string): Promise<{ success: boolean; sid?: string }> {
  if (!twilioConfig.isConfigured) {
    console.log(`[LLAMADA SIMULADA] Para: ${to}`);
    return { success: true };
  }
  try {
    const client = getTwilioClient();
    const call = await client.calls.create({ url: twimlUrl, from: twilioConfig.phoneNumber, to });
    return { success: true, sid: call.sid };
  } catch (err: any) {
    console.error('Twilio Call error:', err.message);
    return { success: false };
  }
}

// ══════════════════════════════════════
// ELEVENLABS — Voz AI
// ══════════════════════════════════════
export const elevenLabsConfig = {
  apiKey:  process.env.ELEVENLABS_API_KEY || '',
  voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  get isConfigured() { return !!this.apiKey; },
};

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (!elevenLabsConfig.isConfigured) {
    console.log(`[TTS SIMULADO] Texto: "${text.substring(0, 60)}..."`);
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsConfig.voiceId}`,
      {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      {
        headers: {
          'xi-api-key': elevenLabsConfig.apiKey,
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );
    return Buffer.from(response.data);
  } catch (err: any) {
    console.error('ElevenLabs error:', err.message);
    return null;
  }
}

// ══════════════════════════════════════
// STRIPE — Pagos
// ══════════════════════════════════════
export const stripeConfig = {
  secretKey:      process.env.STRIPE_SECRET_KEY        || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY   || '',
  webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET    || '',
  get isConfigured() { return !!this.secretKey; },
  get isTestMode()   { return this.secretKey.startsWith('sk_test_'); },
  prices: {
    basicMonthly:        process.env.STRIPE_PRICE_BASIC_MONTHLY        || '',
    professionalMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '',
    enterpriseMonthly:   process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY   || '',
  },
};

export function getStripeClient() {
  if (!stripeConfig.isConfigured) throw new Error('Stripe no configurado. Agrega STRIPE_SECRET_KEY en .env');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe');
  return new Stripe(stripeConfig.secretKey, { apiVersion: '2024-04-10' });
}

// ══════════════════════════════════════
// OPENAI — Scoring AI
// ══════════════════════════════════════
export const aiConfig = {
  openaiKey:    process.env.OPENAI_API_KEY    || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  model:        process.env.AI_MODEL          || 'gpt-4o-mini',
  disabled:     process.env.AI_DISABLE        === 'true',
  get isConfigured() { return !this.disabled && (!!this.openaiKey || !!this.anthropicKey); },
  get provider():    'openai' | 'anthropic' | 'none' {
    if (this.anthropicKey) return 'anthropic';
    if (this.openaiKey)    return 'openai';
    return 'none';
  },
};

export async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!aiConfig.isConfigured) {
    return JSON.stringify({ score: 50, temperature: 'WARM', summary: 'Scoring por reglas (sin API key)' });
  }
  if (aiConfig.provider === 'openai') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: aiConfig.openaiKey });
    const resp = await client.chat.completions.create({
      model:    aiConfig.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
    });
    return resp.choices[0]?.message?.content || '{}';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey: aiConfig.anthropicKey });
    const resp = await client.messages.create({
      model:      'claude-3-haiku-20240307',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return resp.content[0]?.text || '{}';
  }
}

// ══════════════════════════════════════
// RESEND — Email
// ══════════════════════════════════════
export const emailConfig = {
  apiKey:    process.env.RESEND_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL     || 'noreply@leadsphere.app',
  fromName:  process.env.FROM_NAME      || 'LeadSphere Pro',
  get isConfigured() { return !!this.apiKey; },
};

export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean }> {
  if (!emailConfig.isConfigured) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`);
    return { success: true };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require('resend');
    const resend = new Resend(emailConfig.apiKey);
    await resend.emails.send({
      from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
      to, subject, html,
    });
    return { success: true };
  } catch (err: any) {
    console.error('Resend email error:', err.message);
    return { success: false };
  }
}