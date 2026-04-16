import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name"),
  hemoglobin: real("hemoglobin"),
  wbc: real("wbc"),
  glucose: real("glucose"),
  vitaminD: real("vitamin_d"),
  cholesterol: real("cholesterol"),
  platelets: real("platelets"),
  doctorRemarks: text("doctor_remarks"),
  explanation: text("explanation").notNull(),
  riskLevel: text("risk_level").notNull(),
  urgency: text("urgency").notNull(),
  abnormalCount: integer("abnormal_count").notNull(),
  confidence: real("confidence").notNull(),
  confidenceReason: text("confidence_reason").notNull(),
  completenessScore: real("completeness_score").notNull().default(0),
  recommendations: text("recommendations").notNull(),
  diseaseRisks: text("disease_risks").notNull(),
  clinicalInsights: text("clinical_insights").notNull(),
  severityBreakdown: text("severity_breakdown").notNull(),
  validationStatus: text("validation_status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
