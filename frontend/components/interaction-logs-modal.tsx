"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, ArrowUp, ArrowDown } from "lucide-react"
import { getApiKey } from "@/lib/indexeddb"
import type { EnrichedRevive } from "@/lib/revive-enrichment"

interface InteractionLog {
  id: string
  timestamp: number
  details: {
    id: number
    title: string
    category: string
  }
  data: {
    sender?: number
    items?: Array<{ id: number; uid: number | null; qty: number }>
    message?: string
    money?: number
  }
  params: {
    color?: string
  }
}

type TimelineEvent =
  | { type: "log"; timestamp: number; data: InteractionLog }
  | { type: "revive"; timestamp: number; data: EnrichedRevive }

interface InteractionLogsModalProps {
  isOpen: boolean
  onClose: () => void
  targetId: number
  targetName: string
  revives?: EnrichedRevive[]
}

interface TornItem {
  id: number
  name: string
  image: string
}

export function InteractionLogsModal({ isOpen, onClose, targetId, targetName, revives = [] }: InteractionLogsModalProps) {
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [items, setItems] = useState<Map<number, TornItem>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetRevives = useMemo(() => {
    return revives.filter((r) => r.target.id === targetId)
  }, [revives, targetId])

  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []
    for (const log of logs) {
      events.push({ type: "log", timestamp: log.timestamp, data: log })
    }
    for (const revive of targetRevives) {
      events.push({ type: "revive", timestamp: revive.timestamp, data: revive })
    }
    events.sort((a, b) => b.timestamp - a.timestamp)
    return events
  }, [logs, targetRevives])

  useEffect(() => {
    if (isOpen) {
      fetchLogs()
      fetchItems()
    }
  }, [isOpen, targetId])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)

      const apiKey = await getApiKey()
      if (!apiKey) {
        setError("API key not found")
        return
      }

      const response = await fetch(`https://api.torn.com/v2/user/log?target=${targetId}&limit=100`, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch logs")
      }

      const data = await response.json()

      // Filter for item and money receive logs
      const filteredLogs = data.log.filter((log: InteractionLog) => log.details.id === 4103 || log.details.id === 4810)

      setLogs(filteredLogs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs")
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async () => {
    try {
      const apiKey = await getApiKey()
      if (!apiKey) return

      const response = await fetch(`https://api.torn.com/v2/torn/items?sort=ASC`, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) return

      const data = await response.json()
      const itemsMap = new Map<number, TornItem>()

      data.items.forEach((item: any) => {
        itemsMap.set(item.id, {
          id: item.id,
          name: item.name,
          image: `https://www.torn.com/images/items/${item.id}/large.png`,
        })
      })

      setItems(itemsMap)
    } catch (err) {
      console.error("Failed to fetch items:", err)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Recent Interactions with {targetName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <div className="text-destructive text-center py-4">{error}</div>}

        {!loading && !error && timeline.length === 0 && (
          <div className="text-muted-foreground text-center py-8">No recent interactions or revives found.</div>
        )}

        {!loading && !error && timeline.length > 0 && (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {timeline.map((event) => {
                if (event.type === "revive") {
                  const revive = event.data
                  return (
                    <div
                      key={`revive-${revive.timestamp}-${revive.target.id}`}
                      className="rounded-lg border border-border bg-card p-4 space-y-2"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: revive.Success ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={
                                revive.Success
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }
                            >
                              {revive.Success ? "Revive Success" : "Revive Failed"}
                            </Badge>
                            <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border text-xs">
                              {revive.Category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Chance:{" "}
                              <span
                                className={
                                  revive.Chance >= 80
                                    ? "text-green-400 font-medium"
                                    : revive.Chance >= 50
                                      ? "text-yellow-400 font-medium"
                                      : "text-red-400 font-medium"
                                }
                              >
                                {revive.Chance.toFixed(2)}%
                              </span>
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              {revive.Success ? (
                                <ArrowUp className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1.5 truncate">
                            {revive.HospitalizedBy}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                          {formatTimestamp(revive.timestamp)}
                        </div>
                      </div>
                    </div>
                  )
                }

                const log = event.data
                return (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-card p-4 space-y-2"
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor:
                        log.params.color === "green"
                          ? "rgb(34, 197, 94)"
                          : log.params.color === "red"
                            ? "rgb(239, 68, 68)"
                            : "rgb(148, 163, 184)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={
                              log.details.id === 4103
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            }
                          >
                            {log.details.title}
                          </Badge>
                        </div>

                        {log.details.id === 4103 && log.data.items && (
                          <div className="space-y-2 mt-3">
                            {log.data.items.map((item, idx) => {
                              const tornItem = items.get(item.id)
                              return (
                                <div key={idx} className="flex items-center gap-3">
                                  <img
                                    src={`https://www.torn.com/images/items/${item.id}/large.png`}
                                    alt={tornItem?.name || `Item ${item.id}`}
                                    className="w-12 h-12 object-contain bg-muted rounded border border-border"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = "none"
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium">{tornItem?.name || `Item #${item.id}`}</div>
                                    <div className="text-sm text-muted-foreground">Quantity: {item.qty}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {log.details.id === 4810 && log.data.money && (
                          <div className="text-lg font-semibold text-green-400 mt-2">{formatMoney(log.data.money)}</div>
                        )}

                        {log.data.message && (
                          <div className="text-sm text-muted-foreground italic mt-2 bg-muted/30 p-2 rounded">
                            &quot;{log.data.message}&quot;
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
