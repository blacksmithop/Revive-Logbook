// TypeScript implementation of the Python enrichment logic
export interface ReviveData {
  id: number
  reviver: {
    id: number
    name: string
    faction?: {
      id: number
      name: string
    }
    skill?: number
  }
  target: {
    id: number
    name: string
    faction?: {
      id: number
      name: string
    }
    hospital_reason?: string
  }
  result: string
  success_chance: number
  timestamp: number
}

export interface EnrichedRevive extends ReviveData {
  Success: boolean
  Category: "PvP" | "OD" | "Crime" | "RR" | "Self Hosp" | "Casino"
  Chance: number
  Likelihood: "Low" | "Medium" | "High" | "Very High"
  Gain: number | null
  HospitalizedBy: string
}

function getCategory(reason: string): "PvP" | "OD" | "Crime" | "RR" | "Self Hosp" | "Casino" {
  // Russian Roulette
  if (reason.includes("Shot themselves in the foot")) {
    return "RR"
  }

  // Self Hospitalization
  if (reason.includes("Severe emesis following Ipecac Syrup ingestion")) {
    return "Self Hosp"
  }

  // Casino (face punch, kick to throat, choke hold)
  if (
    reason.includes("Punched in the face by Leslie") ||
    reason.includes("face punch") ||
    reason.includes("kick to the throat") ||
    reason.includes("choke hold")
  ) {
    return "Casino"
  }

  // Original categories
  if (["Lost to", "Mugged by", "Hospitalized by"].some((p) => reason.includes(p))) {
    return "PvP"
  }
  if (["Overdosed on", "Collapsed after"].some((o) => reason.includes(o))) {
    return "OD"
  }
  return "Crime"
}

function getLikelihood(chance: number): "Low" | "Medium" | "High" | "Very High" {
  if (chance <= 30) return "Low"
  if (chance <= 60) return "Medium"
  if (chance <= 80) return "High"
  return "Very High"
}

export function enrichRevives(revives: ReviveData[], userReviveId: number): EnrichedRevive[] {
  if (!revives || revives.length === 0) return []

  // First pass: add basic enrichment
  const enriched = revives.map((revive) => {
    const hospitalizedBy = revive.target.hospital_reason || ""
    const chance = revive.success_chance || 0

    return {
      ...revive,
      Success: revive.result === "success",
      Category: getCategory(hospitalizedBy),
      Chance: chance,
      Likelihood: getLikelihood(chance),
      Gain: null as number | null,
      HospitalizedBy: hospitalizedBy,
    }
  })

  // Second pass: calculate skill gains for successful revives by the user
  const mySuccessfulRevives = enriched
    .map((r, idx) => ({ revive: r, index: idx }))
    .filter(
      ({ revive }) =>
        revive.reviver.id === userReviveId && revive.target.id !== userReviveId && revive.result === "success",
    )
    .sort((a, b) => a.revive.timestamp - b.revive.timestamp)

  for (let i = 0; i < mySuccessfulRevives.length - 1; i++) {
    const current = mySuccessfulRevives[i].revive
    const next = mySuccessfulRevives[i + 1].revive

    const currentSkill = current.reviver.skill || 0
    const nextSkill = next.reviver.skill || 0

    if (nextSkill >= 100) {
      enriched[mySuccessfulRevives[i].index].Gain = 0
    } else {
      const gain = currentSkill - nextSkill
      enriched[mySuccessfulRevives[i].index].Gain = Math.round(gain * 100) / 100
    }
  }

  return enriched
}
