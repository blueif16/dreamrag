import { z } from "zod";
import type { ToolParameter } from "@/types/state";

/**
 * Converts a WidgetConfig parameter map to a Zod schema object
 * for use with useFrontendTool.
 */
export function configToZod(
  parameters: Record<string, ToolParameter>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, param] of Object.entries(parameters)) {
    let field: z.ZodTypeAny;

    switch (param.type) {
      case "number":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "array":
        field = z.array(z.any());
        break;
      case "object":
        field = z.record(z.any());
        break;
      default:
        field = z.string();
    }

    if (param.enum) {
      field = z.enum(param.enum as [string, ...string[]]);
    }

    if (param.description) {
      field = field.describe(param.description);
    }

    if (param.default !== undefined) {
      field = field.optional().default(param.default as never);
    }

    shape[key] = field;
  }

  return z.object(shape);
}
