import { z } from "zod";

const chartPointSchema = z.object({
    label: z.string().min(1),
    value: z.coerce.number().finite(),
});

const chartSeriesSchema = z.object({
    name: z.string().min(1),
    data: z.array(chartPointSchema).min(1).max(60),
});

export const chartSchema = z.object({
    chartType: z.enum(["bar", "line", "pie"]),
    xLabel: z.string().default(""),
    yLabel: z.string().default(""),
    series: z.array(chartSeriesSchema).min(1).max(6),
});

export const diagramSchema = z.object({
    diagramType: z.enum([
        "flowchart",
        "sequence",
        "mindmap",
        "timeline",
        "state",
        "er",
        "class",
        "gantt",
        "journey",
    ]),
    mermaid: z.string().trim().min(1).max(20000),
});

const tableCellSchema = z
    .union([z.string(), z.number(), z.boolean()])
    .transform((value) => String(value));

export const tableSchema = z.object({
    columns: z.array(tableCellSchema).min(1).max(12),
    rows: z.array(z.array(tableCellSchema)).min(1).max(100),
});

const suggestionSchema = z.object({
    label: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(400),
    reason: z.string().trim().max(200).optional(),
});

const highlightIndexesSchema = z
    .array(z.coerce.number().int().min(0).max(19))
    .max(20)
    .nullable()
    .optional();

const highlightsSchema = z.object({
    compare: highlightIndexesSchema,
    swap: highlightIndexesSchema,
    active: highlightIndexesSchema,
    sorted: highlightIndexesSchema,
});

const variableValueSchema = z.union([
    z.string().max(80),
    z.number().finite(),
    z.boolean(),
]);

const variablesSchema = z
    .record(z.string().min(1).max(40), variableValueSchema)
    .refine((value) => Object.keys(value).length <= 8, {
        message: "at most 8 variables are allowed",
    });

const animationFrameSchema = z.object({
    caption: z.string().trim().min(1).max(600),
    codeLine: z.number().int().min(1).max(40).nullable().optional(),
    array: z
        .array(z.coerce.number().finite())
        .min(1)
        .max(20)
        .nullable()
        .optional(),
    highlights: highlightsSchema.nullable().optional(),
    variables: variablesSchema.nullable().optional(),
    nodeIds: z
        .array(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/))
        .max(12)
        .nullable()
        .optional(),
});

export const animationSchema = z
    .object({
        animationType: z.enum(["algorithm", "process"]),
        code: z
            .array(
                z
                    .string()
                    .max(200)
                    .refine((line) => line.trim().length > 0, {
                        message: "code lines cannot be blank",
                    })
            )
            .min(1)
            .max(30)
            .nullable()
            .optional(),
        mermaid: z.string().trim().min(1).max(20000).nullable().optional(),
        frames: z.array(animationFrameSchema).min(2).max(24),
    })
    .superRefine((value, ctx) => {
        if (value.animationType === "process") {
            if (!value.mermaid) {
                ctx.addIssue({
                    code: "custom",
                    path: ["mermaid"],
                    message: "mermaid is required for a process animation",
                });
            }

            const hasNodeHighlight = value.frames.some(
                (frame) => frame.nodeIds && frame.nodeIds.length > 0
            );

            if (!hasNodeHighlight) {
                ctx.addIssue({
                    code: "custom",
                    path: ["frames"],
                    message:
                        "at least one frame must highlight nodeIds for a process animation",
                });
            }
        }

        if (value.animationType === "algorithm") {
            const hasArray = value.frames.some(
                (frame) => frame.array && frame.array.length > 0
            );

            if (!value.code?.length && !hasArray) {
                ctx.addIssue({
                    code: "custom",
                    path: ["frames"],
                    message:
                        "an algorithm animation needs code lines or an array state",
                });
            }
        }
    });

export const visualizationSchema = z
    .object({
        type: z.enum(["chart", "diagram", "table", "text", "animation"]),
        language: z.enum(["en", "hi", "kn"]).default("en"),
        title: z.string().trim().min(1).max(160),
        summary: z.string().trim().min(1).max(4000),
        chart: chartSchema.nullable().optional(),
        diagram: diagramSchema.nullable().optional(),
        table: tableSchema.nullable().optional(),
        animation: animationSchema.nullable().optional(),
        suggestion: suggestionSchema.nullable().optional(),
    })
    .superRefine((value, ctx) => {
        if (value.type === "chart" && !value.chart) {
            ctx.addIssue({
                code: "custom",
                path: ["chart"],
                message: "chart is required when type is chart",
            });
        }

        if (value.type === "diagram" && !value.diagram) {
            ctx.addIssue({
                code: "custom",
                path: ["diagram"],
                message: "diagram is required when type is diagram",
            });
        }

        if (value.type === "table" && !value.table) {
            ctx.addIssue({
                code: "custom",
                path: ["table"],
                message: "table is required when type is table",
            });
        }

        if (value.type === "animation" && !value.animation) {
            ctx.addIssue({
                code: "custom",
                path: ["animation"],
                message: "animation is required when type is animation",
            });
        }

        if (value.type === "chart" && value.chart?.chartType === "pie") {
            if (value.chart.series.length > 1) {
                ctx.addIssue({
                    code: "custom",
                    path: ["chart", "series"],
                    message: "pie charts support exactly one series",
                });
            }
        }
    });

export function formatValidationError(error) {
    if (error instanceof z.ZodError) {
        return error.issues
            .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
            .join("; ");
    }

    return error?.message || "Unknown validation error";
}
