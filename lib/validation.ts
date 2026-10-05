import {z} from "zod";
export const assistantSchema=z.object({
 name:z.string().min(1).max(80),slug:z.string().regex(/^[a-z0-9-]+$/),
 description:z.string().max(500),systemPrompt:z.string().min(1).max(20000),
 providerId:z.string().optional().nullable(),modelName:z.string().min(1),
 voiceId:z.string().optional().nullable(),temperature:z.number().min(0).max(2),
 enableWeb:z.boolean(),enableStory:z.boolean(),enableMemory:z.boolean(),enabled:z.boolean()
});