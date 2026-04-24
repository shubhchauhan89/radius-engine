import { z } from 'zod';

export const StrategySchema = z.object({
  targetIntent: z.enum(['informational', 'transactional', 'local']),
  lsiKeywords: z.array(z.string()),
  pageAngle: z.string(),
});

export const OutlineSchema = z.array(
  z.object({
    type: z.string().describe('e.g., H1, H2, H3'),
    topic: z.string(),
    requiresClientContext: z.boolean(),
  })
);

export const AuditorSchema = z.object({
  isApproved: z.boolean(),
  feedback: z.string(),
});
