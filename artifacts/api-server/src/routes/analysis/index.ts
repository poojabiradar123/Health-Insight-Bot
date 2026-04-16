import { Router, type IRouter } from "express";
import { db, analysesTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { runClinicalEngine, buildLLMPrompt } from "../../lib/clinicalEngine.js";
import { AnalyzeReportBody, GetAnalysisByIdParams } from "@workspace/api-zod";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function computeCompleteness(values: {
  hemoglobin?: number | null;
  wbc?: number | null;
  glucose?: number | null;
  vitaminD?: number | null;
  cholesterol?: number | null;
  platelets?: number | null;
}): number {
  const total = 6;
  const provided = [
    values.hemoglobin,
    values.wbc,
    values.glucose,
    values.vitaminD,
    values.cholesterol,
    values.platelets,
  ].filter((v) => v != null).length;
  return Math.round((provided / total) * 100) / 100;
}

router.post("/analysis/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = parsed.data;
  const engineOutput = runClinicalEngine(values);

  if (engineOutput.validationStatus === "Invalid Data") {
    res.status(400).json({ error: engineOutput.validationError ?? "Invalid or inconsistent medical data" });
    return;
  }

  const completenessScore = computeCompleteness(values);

  const urgencyConsistency = (riskLevel: string): "Routine" | "Soon" | "Immediate" => {
    if (riskLevel === "High") return "Immediate";
    if (riskLevel === "Moderate") return "Soon";
    return "Routine";
  };
  const finalUrgency = urgencyConsistency(engineOutput.riskLevel);

  let explanation = "";
  try {
    const prompt = buildLLMPrompt(values, { ...engineOutput, urgency: finalUrgency });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical report explainer. You ONLY describe the findings using the exact severity labels given to you. " +
            "You MUST NOT reinterpret numerical values independently. " +
            "You MUST NOT introduce diseases not listed in the disease_risks field. " +
            "You MUST NOT exaggerate. " +
            "If a parameter is listed as Normal, say it is normal — do NOT suggest problems. " +
            "Be concise, factual, and conservative like a cautious doctor.",
        },
        { role: "user", content: prompt },
      ],
    });
    explanation = completion.choices[0]?.message?.content ?? "Unable to generate explanation.";
  } catch (err) {
    req.log.error({ err }, "LLM explanation failed, using fallback");
    const abnormalParts: string[] = [];
    if (engineOutput.severityBreakdown.hemoglobin && engineOutput.severityBreakdown.hemoglobin !== "Normal") {
      abnormalParts.push(`hemoglobin is ${engineOutput.severityBreakdown.hemoglobin.toLowerCase()}`);
    }
    if (engineOutput.severityBreakdown.wbc && engineOutput.severityBreakdown.wbc !== "Normal") {
      abnormalParts.push(`WBC is ${engineOutput.severityBreakdown.wbc.toLowerCase()}`);
    }
    if (engineOutput.severityBreakdown.glucose && engineOutput.severityBreakdown.glucose !== "Normal") {
      abnormalParts.push(`glucose is ${engineOutput.severityBreakdown.glucose.toLowerCase()}`);
    }
    if (engineOutput.severityBreakdown.cholesterol && engineOutput.severityBreakdown.cholesterol !== "Normal") {
      abnormalParts.push(`cholesterol is ${engineOutput.severityBreakdown.cholesterol.toLowerCase()}`);
    }
    if (engineOutput.severityBreakdown.vitaminD && engineOutput.severityBreakdown.vitaminD !== "Normal") {
      abnormalParts.push(`Vitamin D shows ${engineOutput.severityBreakdown.vitaminD.toLowerCase()}`);
    }
    if (engineOutput.severityBreakdown.platelets && engineOutput.severityBreakdown.platelets !== "Normal") {
      abnormalParts.push(`platelets are ${engineOutput.severityBreakdown.platelets.toLowerCase()}`);
    }
    if (abnormalParts.length > 0) {
      explanation = `Analysis shows ${abnormalParts.join(", ")}. Overall risk is ${engineOutput.riskLevel.toLowerCase()} with ${finalUrgency.toLowerCase()} follow-up recommended.`;
    } else {
      explanation = "All provided lab values are within normal ranges. Continue routine monitoring as advised.";
    }
  }

  const [saved] = await db.insert(analysesTable).values({
    patientName: values.patientName ?? null,
    hemoglobin: values.hemoglobin ?? null,
    wbc: values.wbc ?? null,
    glucose: values.glucose ?? null,
    vitaminD: values.vitaminD ?? null,
    cholesterol: values.cholesterol ?? null,
    platelets: values.platelets ?? null,
    doctorRemarks: values.doctorRemarks ?? null,
    explanation,
    riskLevel: engineOutput.riskLevel,
    urgency: finalUrgency,
    abnormalCount: engineOutput.abnormalCount,
    confidence: engineOutput.confidence,
    confidenceReason: engineOutput.confidenceReason,
    completenessScore,
    recommendations: JSON.stringify(engineOutput.recommendations),
    diseaseRisks: JSON.stringify(engineOutput.diseaseRisks),
    clinicalInsights: JSON.stringify(engineOutput.clinicalInsights),
    severityBreakdown: JSON.stringify(engineOutput.severityBreakdown),
    validationStatus: engineOutput.validationStatus,
  }).returning();

  res.json({
    id: saved.id,
    patientName: saved.patientName,
    explanation,
    risk_level: engineOutput.riskLevel,
    urgency: finalUrgency,
    severity_breakdown: engineOutput.severityBreakdown,
    abnormal_count: engineOutput.abnormalCount,
    confidence: engineOutput.confidence,
    confidence_reason: engineOutput.confidenceReason,
    completeness_score: completenessScore,
    recommendations: engineOutput.recommendations,
    disease_risks: engineOutput.diseaseRisks,
    clinical_insights: engineOutput.clinicalInsights,
    validation_status: engineOutput.validationStatus,
    createdAt: saved.createdAt.toISOString(),
  });
});

router.get("/analysis/history", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: analysesTable.id,
      patientName: analysesTable.patientName,
      riskLevel: analysesTable.riskLevel,
      urgency: analysesTable.urgency,
      abnormalCount: analysesTable.abnormalCount,
      confidence: analysesTable.confidence,
      completenessScore: analysesTable.completenessScore,
      validationStatus: analysesTable.validationStatus,
      createdAt: analysesTable.createdAt,
    })
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt))
    .limit(50);

  res.json(rows.map((r) => ({
    id: r.id,
    patientName: r.patientName,
    risk_level: r.riskLevel,
    urgency: r.urgency,
    abnormal_count: r.abnormalCount,
    confidence: r.confidence,
    completeness_score: r.completenessScore ?? 0,
    validation_status: r.validationStatus,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.get("/analysis/history/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisByIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json({
    id: row.id,
    patientName: row.patientName,
    explanation: row.explanation,
    risk_level: row.riskLevel,
    urgency: row.urgency,
    severity_breakdown: JSON.parse(row.severityBreakdown),
    abnormal_count: row.abnormalCount,
    confidence: row.confidence,
    confidence_reason: row.confidenceReason,
    completeness_score: row.completenessScore ?? 0,
    recommendations: JSON.parse(row.recommendations),
    disease_risks: JSON.parse(row.diseaseRisks),
    clinical_insights: JSON.parse(row.clinicalInsights),
    validation_status: row.validationStatus,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/analysis/stats", async (req, res): Promise<void> => {
  const [totalsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analysesTable);

  const totalAnalyses = totalsRow?.count ?? 0;

  const riskRows = await db
    .select({ riskLevel: analysesTable.riskLevel, count: sql<number>`count(*)::int` })
    .from(analysesTable)
    .groupBy(analysesTable.riskLevel);

  const urgencyRows = await db
    .select({ urgency: analysesTable.urgency, count: sql<number>`count(*)::int` })
    .from(analysesTable)
    .groupBy(analysesTable.urgency);

  const riskLevelCounts = { Low: 0, Moderate: 0, High: 0 };
  for (const r of riskRows) {
    if (r.riskLevel === "Low" || r.riskLevel === "Moderate" || r.riskLevel === "High") {
      riskLevelCounts[r.riskLevel] = r.count;
    }
  }

  const urgencyCounts = { Routine: 0, Soon: 0, Immediate: 0 };
  for (const r of urgencyRows) {
    if (r.urgency === "Routine" || r.urgency === "Soon" || r.urgency === "Immediate") {
      urgencyCounts[r.urgency] = r.count;
    }
  }

  const [avgRow] = await db
    .select({
      avgConfidence: sql<number>`avg(confidence)::float`,
      avgAbnormal: sql<number>`avg(abnormal_count)::float`,
    })
    .from(analysesTable);

  const allRows = await db.select({ severityBreakdown: analysesTable.severityBreakdown }).from(analysesTable);
  const paramCounts: Record<string, number> = {};
  for (const row of allRows) {
    try {
      const sb = JSON.parse(row.severityBreakdown) as Record<string, string | null>;
      for (const [param, sev] of Object.entries(sb)) {
        if (sev && sev !== "Normal") {
          paramCounts[param] = (paramCounts[param] ?? 0) + 1;
        }
      }
    } catch {
    }
  }

  const mostFrequentAbnormalities = Object.entries(paramCounts)
    .map(([parameter, count]) => ({ parameter, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  res.json({
    totalAnalyses,
    riskLevelCounts,
    urgencyCounts,
    mostFrequentAbnormalities,
    averageConfidence: Math.round((avgRow?.avgConfidence ?? 0) * 100) / 100,
    averageAbnormalCount: Math.round((avgRow?.avgAbnormal ?? 0) * 100) / 100,
  });
});

export default router;
