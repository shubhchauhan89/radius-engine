import { createGoogleGenerativeAI } from '@ai-sdk/google';

// The GOOGLE_GENERATIVE_AI_API_KEY environment variable will be used automatically
// by the Vercel AI SDK if not explicitly passed, but we pass it explicitly here as requested.
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
