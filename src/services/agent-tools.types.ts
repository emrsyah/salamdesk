import { z } from "zod";

export const httpParamSchema = z.object({
  name: z.string().min(1),
  in: z.enum(["query", "path", "body"]),
  type: z.enum(["string", "number", "boolean"]).default("string"),
  required: z.boolean().default(false),
  description: z.string().default(""),
});

export const httpToolConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  // May contain {path} placeholders, so it is NOT a strict URL. The real guard
  // is `isHostAllowed` at execution time. (z.string().url() is deprecated in
  // zod v4 and would reject templates anyway.)
  urlTemplate: z.string().startsWith("http"),
  headers: z.record(z.string(), z.string()).default({}),
  params: z.array(httpParamSchema).default([]),
  bodyTemplate: z.string().default(""), // optional JSON template with {placeholders}
  responseJsonPath: z.string().default(""), // optional dot-path to extract; "" = whole body
});

export const exaToolConfigSchema = z.object({
  numResults: z.number().int().min(1).max(10).default(5),
});

export type HttpParam = z.infer<typeof httpParamSchema>;
export type HttpToolConfig = z.infer<typeof httpToolConfigSchema>;
export type ExaToolConfig = z.infer<typeof exaToolConfigSchema>;
