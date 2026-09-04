import { MASTER_ENHANCER_SYSTEM_PROMPT, buildEnhancerUserPrompt } from './systemPrompt.js';
import { UserEnhanceRequest } from './types.js';

export interface LLMProviderConfig {
  provider: 'google' | 'openai' | 'anthropic';
  apiKey?: string;
  modelId?: string;
}

function getGoogleApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api/google-ai';
  }
  return 'https://generativelanguage.googleapis.com/v1beta';
}

const CANDIDATE_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
];

declare const process: { env: Record<string, string | undefined> } | undefined;

function getEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

export class LLMAdapter {
  static async callLLM(config: LLMProviderConfig, request: UserEnhanceRequest): Promise<string> {
    const provider = config.provider || 'google';

    switch (provider) {
      case 'google':
        return this.callGemini(config.apiKey, config.modelId || 'gemini-2.5-flash', request);
      case 'openai':
        return this.callOpenAI(config.apiKey, config.modelId || 'gpt-4o', request);
      case 'anthropic':
        return this.callAnthropic(config.apiKey, config.modelId || 'claude-3-7-sonnet-20250219', request);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private static async callGemini(
    apiKey: string | undefined,
    modelId: string,
    request: UserEnhanceRequest,
  ): Promise<string> {
    const key = apiKey || getEnv('GEMINI_API_KEY');
    if (!key) {
      throw new Error('GEMINI_API_KEY is required to call Gemini API.');
    }

    const apiBase = getGoogleApiBase();
    const userPrompt = buildEnhancerUserPrompt(request);

    const body = {
      system_instruction: {
        parts: [{ text: MASTER_ENHANCER_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.7,
      },
    };

    const modelsToTry = [
      modelId,
      ...CANDIDATE_GEMINI_MODELS,
    ].filter((val, idx, self) => self.indexOf(val) === idx);

    let lastError = '';

    for (const model of modelsToTry) {
      const cleanModel = model.replace(/^models\//, '');
      const url = `${apiBase}/models/${cleanModel}:generateContent?key=${key}`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          const errorText = await res.text();
          lastError = `[${cleanModel}]: ${errorText.slice(0, 120)}`;
        }
      } catch (err: any) {
        lastError = `[${cleanModel}]: ${err.message || String(err)}`;
      }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError}`);
  }

  private static async callOpenAI(
    apiKey: string | undefined,
    modelId: string,
    request: UserEnhanceRequest,
  ): Promise<string> {
    const key = apiKey || getEnv('OPENAI_API_KEY');
    if (!key) {
      throw new Error('OPENAI_API_KEY is required to call OpenAI API.');
    }

    const url = 'https://api.openai.com/v1/chat/completions';
    const userPrompt = buildEnhancerUserPrompt(request);

    const body = {
      model: modelId,
      messages: [
        { role: 'system', content: MASTER_ENHANCER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API call failed (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Empty response received from OpenAI API.');
    }

    return text;
  }

  private static async callAnthropic(
    apiKey: string | undefined,
    modelId: string,
    request: UserEnhanceRequest,
  ): Promise<string> {
    const key = apiKey || getEnv('ANTHROPIC_API_KEY');
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required to call Anthropic API.');
    }

    const url = 'https://api.anthropic.com/v1/messages';
    const userPrompt = buildEnhancerUserPrompt(request);

    const body = {
      model: modelId,
      max_tokens: 4096,
      system: MASTER_ENHANCER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt + '\n\nIMPORTANT: Return ONLY the JSON object. Do not include markdown code block backticks.',
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API call failed (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const text = data?.content?.[0]?.text;
    if (!text) {
      throw new Error('Empty response received from Anthropic API.');
    }

    return text;
  }
}
