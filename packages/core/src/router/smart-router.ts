import type { RouteCandidate, RouteDecision, RouteRequest, ScoredCandidate } from './types';

const BLOCKED_HEALTH = new Set(['disabled', 'auth_error', 'quota_exhausted', 'unavailable']);

function hasAllCapabilities(candidate: RouteCandidate, required: RouteRequest['requiredCapabilities']): boolean {
  return required.every((cap) => candidate.model.capabilities.includes(cap));
}

function scoreCandidate(candidate: RouteCandidate, request: RouteRequest): ScoredCandidate {
  let score = 50;
  const reasons: string[] = [];
  const benchmark = request.benchmarkCategory ? candidate.model.benchmark[request.benchmarkCategory] : undefined;
  if (benchmark != null) {
    score += benchmark * 3;
    reasons.push(`benchmark:${request.benchmarkCategory}=${benchmark}`);
  }
  for (const cap of request.preferredCapabilities ?? []) {
    if (candidate.model.capabilities.includes(cap)) {
      score += 7;
      reasons.push(`preferred:${cap}`);
    }
  }
  if (candidate.runtime.health === 'healthy') {
    score += 15;
    reasons.push('health:healthy');
  } else if (candidate.runtime.health === 'degraded') {
    score -= 8;
    reasons.push('health:degraded');
  } else if (candidate.runtime.health === 'rate_limited') {
    score -= 20;
    reasons.push('health:rate_limited');
  }
  if (candidate.runtime.quotaRemaining != null) {
    if (candidate.runtime.quotaRemaining > 0) {
      score += Math.min(10, Math.log10(candidate.runtime.quotaRemaining + 1) * 3);
      reasons.push(`quota:${candidate.runtime.quotaRemaining}`);
    }
  }
  if (candidate.model.failureRate != null) {
    score -= Math.min(30, candidate.model.failureRate * 50);
    reasons.push(`failureRate:${candidate.model.failureRate}`);
  }
  if (candidate.model.latencyMsP50 != null && request.qualityProfile === 'FAST') {
    score += Math.max(-20, 15 - candidate.model.latencyMsP50 / 200);
    reasons.push(`latencyP50:${candidate.model.latencyMsP50}`);
  }
  if (candidate.model.costScore != null && request.qualityProfile !== 'BEST_QUALITY') {
    score += Math.max(-10, 10 - candidate.model.costScore);
    reasons.push(`costScore:${candidate.model.costScore}`);
  }
  score += Math.max(-15, 12 - candidate.runtime.adminPriority);
  reasons.push(`adminPriority:${candidate.runtime.adminPriority}`);
  return { ...candidate, score, reasons };
}

export function routeModel(request: RouteRequest, candidates: readonly RouteCandidate[]): RouteDecision {
  if (request.qualityProfile === 'MANUAL' && !request.manualModelId) {
    throw new Error('MANUAL profile requires manualModelId');
  }
  const valid = candidates.filter((candidate) => {
    if (!candidate.model.enabled) return false;
    if (BLOCKED_HEALTH.has(candidate.runtime.health)) return false;
    if (!hasAllCapabilities(candidate, request.requiredCapabilities)) return false;
    if (request.requireCommercialUse && candidate.model.commercialUseAllowed !== true) return false;
    if (request.qualityProfile === 'MANUAL' && candidate.model.id !== request.manualModelId) return false;
    return true;
  });
  if (valid.length === 0) throw new Error('NO_ELIGIBLE_MODEL');
  const scored = valid.map((candidate) => scoreCandidate(candidate, request)).sort((a, b) => b.score - a.score);
  return { selected: scored[0], alternatives: scored.slice(1) };
}
