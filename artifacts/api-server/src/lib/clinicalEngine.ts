export interface LabValues {
  hemoglobin?: number | null;
  wbc?: number | null;
  glucose?: number | null;
  vitaminD?: number | null;
  cholesterol?: number | null;
  platelets?: number | null;
  doctorRemarks?: string | null;
}

export type SeverityLevel =
  | "Normal"
  | "Borderline Low"
  | "Low"
  | "Severely Low"
  | "Borderline High"
  | "High"
  | "Severely High"
  | "Deficiency";

export type RiskLevel = "Low" | "Moderate" | "High";
export type Urgency = "Routine" | "Soon" | "Immediate";
export type ValidationStatus = "Clinically Verified" | "Invalid Data" | "Insufficient Data";

export interface SeverityBreakdown {
  hemoglobin: string | null;
  wbc: string | null;
  glucose: string | null;
  vitaminD: string | null;
  cholesterol: string | null;
  platelets: string | null;
}

export interface AnalysisOutput {
  validationStatus: ValidationStatus;
  severityBreakdown: SeverityBreakdown;
  abnormalCount: number;
  riskLevel: RiskLevel;
  urgency: Urgency;
  confidence: number;
  confidenceReason: string;
  diseaseRisks: string[];
  clinicalInsights: string[];
  recommendations: string[];
  validationError?: string;
  hasSevere: boolean;
  hasHigh: boolean;
}

function validateLabValues(values: LabValues): string | null {
  const checks: Array<[number | null | undefined, string]> = [
    [values.hemoglobin, "Hemoglobin"],
    [values.wbc, "WBC"],
    [values.glucose, "Glucose"],
    [values.vitaminD, "Vitamin D"],
    [values.cholesterol, "Cholesterol"],
    [values.platelets, "Platelets"],
  ];

  for (const [val, name] of checks) {
    if (val != null) {
      if (val < 0) return `${name} cannot be negative`;
      if (!isFinite(val)) return `${name} has an invalid value`;
    }
  }

  if (values.wbc != null && values.wbc > 0 && values.wbc < 100) {
    return "WBC value appears to be in wrong units — should be cells/µL (e.g. 5000–10000), not K/µL";
  }

  if (values.platelets != null && values.platelets > 0 && values.platelets < 10) {
    return "Platelet value appears to be in wrong units";
  }

  const providedCount = checks.filter(([v]) => v != null).length;
  if (providedCount === 0) {
    return "No lab values provided";
  }

  return null;
}

function classifyHemoglobin(val: number): SeverityLevel {
  if (val < 10) return "Severely Low";
  if (val < 12) return "Low";
  if (val < 13.5) return "Borderline Low";
  return "Normal";
}

function classifyWBC(val: number): SeverityLevel {
  if (val > 20000) return "Severely High";
  if (val > 11000) return "High";
  if (val < 4000) return "Low";
  return "Normal";
}

function classifyGlucose(val: number): SeverityLevel {
  if (val >= 200) return "Severely High";
  if (val >= 126) return "High";
  if (val >= 100) return "Borderline High";
  return "Normal";
}

function classifyVitaminD(val: number): SeverityLevel {
  if (val < 20) return "Deficiency";
  return "Normal";
}

function classifyCholesterol(val: number): SeverityLevel {
  if (val > 240) return "High";
  if (val >= 200) return "Borderline High";
  return "Normal";
}

function classifyPlatelets(val: number): SeverityLevel {
  if (val < 100000) return "Severely Low";
  if (val < 150000) return "Low";
  return "Normal";
}

function isAbnormal(sev: SeverityLevel): boolean {
  return sev !== "Normal";
}

function isSevere(sev: SeverityLevel): boolean {
  return sev === "Severely High" || sev === "Severely Low";
}

function isHigh(sev: SeverityLevel): boolean {
  return sev === "High" || sev === "Deficiency";
}

export function runClinicalEngine(values: LabValues): AnalysisOutput {
  const validationError = validateLabValues(values);
  if (validationError) {
    return {
      validationStatus: "Invalid Data",
      severityBreakdown: {
        hemoglobin: null,
        wbc: null,
        glucose: null,
        vitaminD: null,
        cholesterol: null,
        platelets: null,
      },
      abnormalCount: 0,
      riskLevel: "Low",
      urgency: "Routine",
      confidence: 0,
      confidenceReason: "Analysis halted due to invalid data",
      diseaseRisks: [],
      clinicalInsights: [],
      recommendations: ["Please correct the invalid data and resubmit"],
      validationError,
      hasSevere: false,
      hasHigh: false,
    };
  }

  const severityBreakdown: SeverityBreakdown = {
    hemoglobin: values.hemoglobin != null ? classifyHemoglobin(values.hemoglobin) : null,
    wbc: values.wbc != null ? classifyWBC(values.wbc) : null,
    glucose: values.glucose != null ? classifyGlucose(values.glucose) : null,
    vitaminD: values.vitaminD != null ? classifyVitaminD(values.vitaminD) : null,
    cholesterol: values.cholesterol != null ? classifyCholesterol(values.cholesterol) : null,
    platelets: values.platelets != null ? classifyPlatelets(values.platelets) : null,
  };

  const allSeverities = Object.values(severityBreakdown).filter((s): s is SeverityLevel => s != null);
  const hasSevere = allSeverities.some(isSevere);
  const hasHigh = allSeverities.some((s) => isHigh(s) || isSevere(s));
  const abnormalCount = allSeverities.filter(isAbnormal).length;
  const totalProvided = allSeverities.length;

  let riskLevel: RiskLevel;
  if (hasSevere) {
    riskLevel = "High";
  } else if (hasHigh) {
    riskLevel = "Moderate";
    if (abnormalCount >= 6) riskLevel = "High";
  } else if (abnormalCount >= 6) {
    riskLevel = "High";
  } else if (abnormalCount >= 3) {
    riskLevel = "Moderate";
  } else {
    riskLevel = "Low";
  }

  let urgency: Urgency;
  const doctorRemarksLower = (values.doctorRemarks || "").toLowerCase();
  const remarksForcesImmediate = /urgent|emergency|immediate|critical|stat/.test(doctorRemarksLower);
  const remarksForcesRoutine = /routine|stable|follow.up|no concern/.test(doctorRemarksLower);

  if (remarksForcesImmediate) {
    urgency = "Immediate";
  } else if (riskLevel === "High" || hasSevere) {
    urgency = "Immediate";
  } else if (riskLevel === "Moderate" || hasHigh) {
    urgency = remarksForcesRoutine ? "Routine" : "Soon";
  } else {
    urgency = "Routine";
  }

  let confidence: number;
  let confidenceReason: string;
  if (hasSevere) {
    confidence = 0.9;
    confidenceReason = "Severe abnormalities detected — high confidence in classification";
  } else if (abnormalCount >= 3) {
    confidence = 0.8;
    confidenceReason = "Multiple abnormal parameters — good confidence in classification";
  } else if (abnormalCount >= 1) {
    confidence = 0.7;
    confidenceReason = "One or two abnormal parameters — moderate confidence";
  } else if (totalProvided <= 2) {
    confidence = 0.6;
    confidenceReason = "Minimal data provided — confidence is limited";
  } else {
    confidence = 0.7;
    confidenceReason = "All parameters within normal range";
  }

  if (totalProvided < 3) {
    confidence = Math.min(confidence, 0.65);
    confidenceReason = "Insufficient data for full confidence — provide more lab values";
  }

  const diseaseRisks: string[] = [];
  if (severityBreakdown.wbc != null && isAbnormal(severityBreakdown.wbc as SeverityLevel)) {
    if (severityBreakdown.wbc === "Severely High" || severityBreakdown.wbc === "High") {
      diseaseRisks.push("Infection / possible immune activation");
      if (severityBreakdown.wbc === "Severely High") {
        diseaseRisks.push("Leukemia risk (requires specialist evaluation)");
      }
    } else if (severityBreakdown.wbc === "Low") {
      diseaseRisks.push("Immunodeficiency or bone marrow suppression risk");
    }
  }

  if (severityBreakdown.hemoglobin != null && isAbnormal(severityBreakdown.hemoglobin as SeverityLevel)) {
    diseaseRisks.push("Anemia");
  }

  if (severityBreakdown.glucose != null && isAbnormal(severityBreakdown.glucose as SeverityLevel)) {
    if (severityBreakdown.glucose === "Severely High" || severityBreakdown.glucose === "High") {
      diseaseRisks.push("Diabetes mellitus");
    } else {
      diseaseRisks.push("Prediabetes / impaired glucose tolerance");
    }
  }

  if (severityBreakdown.platelets != null && isAbnormal(severityBreakdown.platelets as SeverityLevel)) {
    diseaseRisks.push("Bleeding disorder / thrombocytopenia risk");
  }

  if (severityBreakdown.cholesterol != null && isAbnormal(severityBreakdown.cholesterol as SeverityLevel)) {
    diseaseRisks.push("Cardiovascular disease risk");
  }

  if (severityBreakdown.vitaminD != null && isAbnormal(severityBreakdown.vitaminD as SeverityLevel)) {
    diseaseRisks.push("Bone disease / osteoporosis risk");
    diseaseRisks.push("Immune dysfunction risk");
  }

  const clinicalInsights: string[] = [];
  const wbcSev = severityBreakdown.wbc;
  const hbSev = severityBreakdown.hemoglobin;
  const glucSev = severityBreakdown.glucose;
  const cholSev = severityBreakdown.cholesterol;
  const vitDSev = severityBreakdown.vitaminD;

  if (
    wbcSev != null &&
    (wbcSev === "High" || wbcSev === "Severely High") &&
    hbSev != null &&
    (hbSev === "Low" || hbSev === "Severely Low" || hbSev === "Borderline Low")
  ) {
    clinicalInsights.push("Combined elevated WBC and low hemoglobin may indicate an active infection coexisting with anemia");
  }

  if (
    glucSev != null &&
    isAbnormal(glucSev as SeverityLevel) &&
    cholSev != null &&
    isAbnormal(cholSev as SeverityLevel)
  ) {
    clinicalInsights.push("Elevated glucose and cholesterol together suggest a metabolic syndrome pattern — cardiovascular risk warrants evaluation");
  }

  if (
    hbSev != null &&
    (hbSev === "Low" || hbSev === "Severely Low" || hbSev === "Borderline Low") &&
    vitDSev != null &&
    vitDSev === "Deficiency"
  ) {
    clinicalInsights.push("Low hemoglobin combined with Vitamin D deficiency may indicate nutritional deficiency — dietary assessment recommended");
  }

  const recommendations: string[] = [];
  if (riskLevel === "High" || hasSevere) {
    recommendations.push("Seek immediate medical attention — contact your healthcare provider urgently");
  } else if (riskLevel === "Moderate") {
    recommendations.push("Schedule a follow-up appointment with your healthcare provider soon");
  } else {
    recommendations.push("Continue routine monitoring as advised by your healthcare provider");
  }

  if (severityBreakdown.hemoglobin != null && isAbnormal(severityBreakdown.hemoglobin as SeverityLevel)) {
    recommendations.push("Further evaluation for anemia including iron studies and B12/folate levels");
  }
  if (severityBreakdown.glucose != null && isAbnormal(severityBreakdown.glucose as SeverityLevel)) {
    recommendations.push("Fasting glucose test and HbA1c recommended for diabetes evaluation");
  }
  if (severityBreakdown.cholesterol != null && isAbnormal(severityBreakdown.cholesterol as SeverityLevel)) {
    recommendations.push("Full lipid panel (LDL, HDL, triglycerides) recommended");
  }
  if (severityBreakdown.vitaminD != null && isAbnormal(severityBreakdown.vitaminD as SeverityLevel)) {
    recommendations.push("Vitamin D supplementation and dietary assessment recommended");
  }
  if (severityBreakdown.wbc != null && (severityBreakdown.wbc === "Severely High" || severityBreakdown.wbc === "High")) {
    recommendations.push("WBC differential and peripheral blood smear recommended");
  }
  if (severityBreakdown.platelets != null && isAbnormal(severityBreakdown.platelets as SeverityLevel)) {
    recommendations.push("Repeat platelet count and coagulation studies recommended");
  }

  const validationStatus: ValidationStatus = validationError ? "Invalid Data" : "Clinically Verified";

  return {
    validationStatus,
    severityBreakdown,
    abnormalCount,
    riskLevel,
    urgency,
    confidence,
    confidenceReason,
    diseaseRisks,
    clinicalInsights,
    recommendations,
    hasSevere,
    hasHigh,
  };
}

export function buildLLMPrompt(values: LabValues, engineOutput: AnalysisOutput): string {
  const paramLines: string[] = [];
  if (values.hemoglobin != null) {
    paramLines.push(`- Hemoglobin: ${values.hemoglobin} g/dL — ${engineOutput.severityBreakdown.hemoglobin ?? "Normal"}`);
  }
  if (values.wbc != null) {
    paramLines.push(`- WBC: ${values.wbc} cells/µL — ${engineOutput.severityBreakdown.wbc ?? "Normal"}`);
  }
  if (values.glucose != null) {
    paramLines.push(`- Glucose: ${values.glucose} mg/dL — ${engineOutput.severityBreakdown.glucose ?? "Normal"}`);
  }
  if (values.vitaminD != null) {
    paramLines.push(`- Vitamin D: ${values.vitaminD} ng/mL — ${engineOutput.severityBreakdown.vitaminD ?? "Normal"}`);
  }
  if (values.cholesterol != null) {
    paramLines.push(`- Cholesterol: ${values.cholesterol} mg/dL — ${engineOutput.severityBreakdown.cholesterol ?? "Normal"}`);
  }
  if (values.platelets != null) {
    paramLines.push(`- Platelets: ${values.platelets} cells/µL — ${engineOutput.severityBreakdown.platelets ?? "Normal"}`);
  }

  return `You are a clinical explanation assistant. The following medical lab values have been analyzed by a deterministic rule-based clinical engine. Your task is ONLY to generate a clear, plain-English explanation for the patient or clinician.

STRICT RULES:
- Only explain the parameters listed below. Do NOT introduce any new parameters or conditions not shown.
- Do NOT contradict the severity classifications provided.
- Do NOT diagnose or prescribe treatment.
- Be concise, accurate, and clinically sound.
- Use simple language suitable for a patient.
- Do NOT hallucinate values or medical facts.

ANALYZED LAB VALUES:
${paramLines.join("\n")}

RULE-BASED CLASSIFICATION:
- Overall risk level: ${engineOutput.riskLevel}
- Urgency: ${engineOutput.urgency}
- Abnormal parameters: ${engineOutput.abnormalCount}
${engineOutput.diseaseRisks.length > 0 ? `- Potential concerns: ${engineOutput.diseaseRisks.join(", ")}` : ""}
${values.doctorRemarks ? `- Doctor remarks: ${values.doctorRemarks}` : ""}

Write a 2-4 sentence explanation of what these results mean, based solely on the values above. Explain what abnormal values may indicate and the general level of concern. Do not add medical advice beyond what the rule engine has determined.`;
}
