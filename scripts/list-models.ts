import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function listModels() {
  console.log('🔍 Querying Google API for available Model IDs...');
  try {
    // The Vercel SDK uses the REST API under the hood, but we can fetch standard models via the raw SDK
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY}`);
    const data = await response.json();
    
    console.log('✅ Valid Model Strings for your API Key:');
    data.models.forEach((model: any) => {
      // Only show models that support text/content generation
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`  - ${model.name.replace('models/', '')}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch models:', error);
  }
}

listModels();
