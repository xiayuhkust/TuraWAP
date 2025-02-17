/// <reference types="vite/client" />
import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
export const hasOpenAI = !!apiKey;

export const openai = new OpenAI({
  apiKey: apiKey || '',
  dangerouslyAllowBrowser: true
});

export function validateOpenAIKey(): void {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for agent features');
  }
}
