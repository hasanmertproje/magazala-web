export interface UsageLedgerRecord {
  id: string;
  providerId: string;
  modelId: string;
  operation: string;
  workspaceId: string;
  userId: string;
  requestId: string;
  startedAt: string;
  finishedAt: string | null;
  success: boolean | null;
  inputUnits: number | null;
  outputUnits: number | null;
  imagesGenerated: number | null;
  costAmount: number | null;
  costCurrency: string | null;
  freeQuotaUnits: number | null;
  latencyMs: number | null;
}
