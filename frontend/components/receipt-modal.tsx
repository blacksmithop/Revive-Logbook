"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react"
import { getApiKey, getReceiptSettings, type ReceiptSettings } from "@/lib/indexeddb"
import type { EnrichedRevive } from "@/lib/revive-enrichment"
import { useToast } from "@/hooks/use-toast"

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  revives: EnrichedRevive[]
  mode: "user" | "faction"
}

type DatePreset = "today" | "yesterday" | "7days" | "30days" | "custom"

interface InteractionLog {
  id: string
  timestamp: number
  details: { id: number; title: string; category: string }
  data: {
    sender?: number
    items?: Array<{ id: number; uid: number | null; qty: number }>
    message?: string
    money?: number
  }
  params: { color?: string }
}

export function ReceiptModal({ isOpen, onClose, revives, mode }: ReceiptModalProps) {
  const { toast } = useToast()

  const [playerSearch, setPlayerSearch] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>("30days")
  const [customFrom, setCustomFrom] = useState<Date | undefined>()
  const [customTo, setCustomTo] = useState<Date | undefined>()
  const [includeFailures, setIncludeFailures] = useState(false)
  const [minLikelihood, setMinLikelihood] = useState(0)

  const [loadingLogs, setLoadingLogs] = useState<Record<number, boolean>>({})
  const [loadedTargets, setLoadedTargets] = useState<Set<number>>(new Set())
  const [logsMap, setLogsMap] = useState<Record<number, InteractionLog[]>>({})

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null)
  const [copied, setCopied] = useState(false)

  const [tablePage, setTablePage] = useState(1)
  const tablePageSize = 10

  const uniquePlayers = useMemo(() => {
    const players = new Map<string, number>()
    for (const r of revives) {
      if (r.target.name) players.set(r.target.name, r.target.id)
    }
    return Array.from(players.entries())
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [revives])

  const suggestions = useMemo(() => {
    if (!playerSearch.trim()) return []
    const searchLower = playerSearch.toLowerCase()
    return uniquePlayers.filter((p) => p.name.toLowerCase().includes(searchLower)).slice(0, 8)
  }, [playerSearch, uniquePlayers])

  const dateRange = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    switch (datePreset) {
      case "today":
        return { from: todayStart, to: todayEnd }
      case "yesterday": {
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)
        return { from: yesterdayStart, to: todayStart }
      }
      case "7days": {
        const weekAgo = new Date(todayStart)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return { from: weekAgo, to: todayEnd }
      }
      case "30days": {
        const monthAgo = new Date(todayStart)
        monthAgo.setDate(monthAgo.getDate() - 30)
        return { from: monthAgo, to: todayEnd }
      }
      case "custom":
        return { from: customFrom, to: customTo }
      default:
        return { from: undefined, to: undefined }
    }
  }, [datePreset, customFrom, customTo])

  const filteredRevives = useMemo(() => {
    if (!selectedPlayer) return []
    return revives
      .filter((r) => {
        if (r.target.name !== selectedPlayer) return false
        if (!includeFailures && !r.Success) return false
        if (dateRange.from) {
          const reviveDate = new Date(r.timestamp * 1000)
          if (reviveDate < dateRange.from) return false
          if (dateRange.to && reviveDate > dateRange.to) return false
        }
        if (minLikelihood > 0 && r.Chance < minLikelihood) return false
        return true
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [selectedPlayer, revives, includeFailures, dateRange, minLikelihood])

  const totalRevives = filteredRevives.length
  const successfulRevives = filteredRevives.filter((r) => r.Success).length
  const failedRevives = totalRevives - successfulRevives

  const totalTablePages = Math.max(1, Math.ceil(filteredRevives.length / tablePageSize))
  const paginatedRevives = filteredRevives.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize)

  useEffect(() => {
    setTablePage(1)
  }, [selectedPlayer, includeFailures, dateRange, minLikelihood])

  const billableRevives = useMemo(() => {
    if (!includeFailures) return successfulRevives
    return totalRevives
  }, [includeFailures, successfulRevives, totalRevives])

  const totalXanax = useMemo(() => {
    if (!receiptSettings) return 0
    return billableRevives * receiptSettings.xanaxPerRevive
  }, [billableRevives, receiptSettings])

  const totalMoney = useMemo(() => {
    if (!receiptSettings) return 0
    return billableRevives * receiptSettings.moneyPerRevive
  }, [billableRevives, receiptSettings])

  const totalAmountStr = useMemo(() => {
    if (!receiptSettings) return "0"
    const hasXanax = receiptSettings.xanaxPerRevive > 0
    const hasMoney = receiptSettings.moneyPerRevive > 0
    if (hasXanax && hasMoney) return `${totalXanax} Xanax or $${totalMoney.toLocaleString()}`
    if (hasXanax) return `${totalXanax} Xanax`
    if (hasMoney) return `$${totalMoney.toLocaleString()}`
    return "0"
  }, [totalXanax, totalMoney, receiptSettings])

  const receiptText = useMemo(() => {
    if (!receiptSettings) return ""
    return receiptSettings.template
      .replace(/{target}/g, selectedPlayer || "Player")
      .replace(/{revives_done}/g, String(totalRevives))
      .replace(/{total_amount}/g, totalAmountStr)
      .replace(/{successful_revives}/g, String(successfulRevives))
      .replace(/{failed_revives}/g, String(failedRevives))
  }, [receiptSettings, selectedPlayer, totalRevives, successfulRevives, failedRevives, totalAmountStr])

  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(receiptText)
    setCopied(true)
    toast({ title: "Copied", description: "Receipt text copied to clipboard." })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLoadLogs = async (targetId: number) => {
    if (loadedTargets.has(targetId)) return
    setLoadingLogs((prev) => ({ ...prev, [targetId]: true }))
    try {
      const apiKey = await getApiKey()
      if (!apiKey) return
      const response = await fetch(`https://api.torn.com/v2/user/log?target=${targetId}&limit=20`, {
        headers: { accept: "application/json", Authorization: `ApiKey ${apiKey}` },
      })
      if (!response.ok) throw new Error("Failed to fetch logs")
      const data = await response.json()
      const filtered = (data.log || []).filter(
        (log: InteractionLog) => log.details.id === 4103 || log.details.id === 4810
      )
      setLogsMap((prev) => ({ ...prev, [targetId]: filtered }))
      setLoadedTargets((prev) => new Set(prev).add(targetId))
      toast({ title: "Logs loaded", description: `Found ${filtered.length} payment interactions.` })
    } catch {
      toast({ title: "Error", description: "Failed to fetch interaction logs." })
    } finally {
      setLoadingLogs((prev) => ({ ...prev, [targetId]: false }))
    }
  }

  const formatTimestamp = (ts: number) =>
    new Date(ts * 1000).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)

  const selectedPlayerLogs = useMemo(() => {
    if (!selectedPlayer) return []
    const targetId = uniquePlayers.find((p) => p.name === selectedPlayer)?.id
    if (!targetId) return []
    return logsMap[targetId] || []
  }, [selectedPlayer, uniquePlayers, logsMap])

  useEffect(() => {
    if (isOpen) {
      getReceiptSettings().then((s) => setReceiptSettings(s))
    } else {
      setPlayerSearch("")
      setSelectedPlayer(null)
      setLogsMap({})
      setLoadedTargets(new Set())
      setTablePage(1)
    }
  }, [isOpen])

  const getLikelihoodColor = (chance: number) => {
    if (chance >= 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (chance >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    if (chance >= 30) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    return "bg-red-500/20 text-red-400 border-red-500/30"
  }



  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 sm:pt-8 sm:pb-8">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-5xl mx-4 max-h-[95vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
          <h2 className="text-xl font-semibold text-foreground">Create Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-muted/50 hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search + Date Range */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-foreground">Search Player</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Player name..."
                  value={playerSearch}
                  className="pl-9 bg-muted/30 border-border text-foreground placeholder:text-muted-foreground"
                  onChange={(e) => {
                    setPlayerSearch(e.target.value)
                    setShowSuggestions(true)
                    if (!e.target.value.trim()) setSelectedPlayer(null)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-[calc(100%+2px)] left-0 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPlayerSearch(player.name)
                        setSelectedPlayer(player.name)
                        setShowSuggestions(false)
                      }}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date Range</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "7days", label: "7 Days" },
                    { key: "30days", label: "30 Days" },
                    { key: "custom", label: "Custom" },
                  ] as const
                ).map((preset) => (
                  <Button
                    key={preset.key}
                    size="sm"
                    onClick={() => setDatePreset(preset.key)}
                    className={
                      datePreset === preset.key
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-muted/40 text-foreground border border-border hover:bg-muted"
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex gap-2 mt-2">
                  <Input
                    type="date"
                    className="bg-muted/30 border-border text-foreground [color-scheme:dark]"
                    onChange={(e) => setCustomFrom(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                  <Input
                    type="date"
                    className="bg-muted/30 border-border text-foreground [color-scheme:dark]"
                    onChange={(e) => setCustomTo(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 px-4 rounded-lg bg-muted/10 border border-border">
            <div className="flex items-center gap-4">
              <div className="space-y-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
                  <Checkbox checked={includeFailures} onCheckedChange={(checked) => setIncludeFailures(checked === true)} />
                  Include failures
                </label>
                {includeFailures && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Failures with chance {'>'} {minLikelihood}% are billable
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <label className="text-sm font-medium whitespace-nowrap text-foreground">Min Chance</label>
              <Slider
                value={[minLikelihood]}
                onValueChange={([val]) => setMinLikelihood(val)}
                max={100}
                step={1}
                className="flex-1 max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground w-10 text-right">{minLikelihood}%</span>
            </div>

            {selectedPlayer && (
              <div className="sm:ml-auto text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{totalRevives}</span> revives
                <span className="mx-1.5 text-border">|</span>
                <span className="text-green-400">{successfulRevives} success</span>
                <span className="mx-1.5 text-border">|</span>
                <span className="text-red-400">{failedRevives} failed</span>
              </div>
            )}
          </div>

          {/* Revives Table */}
          {selectedPlayer && filteredRevives.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/20">
                    <TableHead className="text-foreground">Target</TableHead>
                    <TableHead className="text-foreground">Faction</TableHead>
                    <TableHead className="text-foreground">Hospitalized By</TableHead>
                    <TableHead className="text-foreground">Chance</TableHead>
                    <TableHead className="text-foreground">Outcome</TableHead>
                    <TableHead className="text-foreground">Timestamp</TableHead>
                    {mode === "user" && <TableHead className="text-foreground">Logs</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRevives.map((revive) => (
                    <TableRow key={revive.id} className="border-border hover:bg-muted/10">
                      <TableCell className="font-medium">
                        <a
                          href={`https://www.torn.com/profiles.php?XID=${revive.target.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-foreground"
                        >
                          {revive.target.name}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {revive.target.faction?.name ? (
                          <a
                            href={`https://www.torn.com/factions.php?step=profile&ID=${revive.target.faction.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {revive.target.faction.name}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{revive.HospitalizedBy || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getLikelihoodColor(revive.Chance)}>
                          {revive.Chance.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {revive.Success ? (
                          <ArrowUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(revive.timestamp)}
                      </TableCell>
                      {mode === "user" && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadLogs(revive.target.id)}
                            disabled={loadingLogs[revive.target.id] || loadedTargets.has(revive.target.id)}
                            className="h-7 px-2 text-foreground"
                          >
                            {loadingLogs[revive.target.id] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : loadedTargets.has(revive.target.id) ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              "Load"
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalTablePages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                  <span className="text-xs text-muted-foreground">
                    Showing {(tablePage - 1) * tablePageSize + 1}-{Math.min(tablePage * tablePageSize, filteredRevives.length)} of {filteredRevives.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTablePage(1)}
                      disabled={tablePage === 1}
                      className="h-7 w-7 p-0 text-foreground"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage === 1}
                      className="h-7 w-7 p-0 text-foreground"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-foreground px-2">
                      {tablePage} / {totalTablePages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                      disabled={tablePage === totalTablePages}
                      className="h-7 w-7 p-0 text-foreground"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTablePage(totalTablePages)}
                      disabled={tablePage === totalTablePages}
                      className="h-7 w-7 p-0 text-foreground"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedPlayer && filteredRevives.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border border-border rounded-lg bg-muted/10">
              No revives found for {selectedPlayer} with the current filters.
            </div>
          )}

          {/* Interaction Logs */}
          {mode === "user" && selectedPlayerLogs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Recent Payments from {selectedPlayer}</h3>
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                {selectedPlayerLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border p-3 text-sm flex items-start justify-between gap-3 bg-muted/10"
                    style={{
                      borderLeftWidth: "3px",
                      borderLeftColor: log.details.id === 4103 ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)",
                    }}
                  >
                    <div className="flex-1 flex items-center flex-wrap gap-2">
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
                      {log.details.id === 4810 && log.data.money && (
                        <span className="font-semibold text-green-400">{formatMoney(log.data.money)}</span>
                      )}
                      {log.details.id === 4103 && log.data.items && (
                        <span className="text-muted-foreground">
                          {log.data.items.map((item) => `Item #${item.id} x${item.qty}`).join(", ")}
                        </span>
                      )}
                      {log.data.message && (
                        <span className="italic text-muted-foreground">{`"${log.data.message}"`}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing Summary + Receipt */}
          {selectedPlayer && filteredRevives.length > 0 && receiptSettings && (
            <div className="space-y-5 border-t border-border pt-5">
              {/* Pricing Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 px-4 rounded-lg bg-muted/10 border border-border">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-sm text-muted-foreground">
                    Rate:{" "}
                    {receiptSettings.xanaxPerRevive > 0 && (
                      <span className="font-medium text-foreground">
                        {receiptSettings.xanaxPerRevive} Xanax
                      </span>
                    )}
                    {receiptSettings.xanaxPerRevive > 0 && receiptSettings.moneyPerRevive > 0 && (
                      <span className="mx-1.5 text-border">or</span>
                    )}
                    {receiptSettings.moneyPerRevive > 0 && (
                      <span className="font-medium text-foreground">
                        ${receiptSettings.moneyPerRevive.toLocaleString()}
                      </span>
                    )}
                    <span className="text-xs ml-1">per revive</span>
                  </div>
                  <div className="h-4 w-px bg-border hidden sm:block" />
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{billableRevives}</span> billable
                    {includeFailures && failedRevives > 0 && (
                      <span className="text-yellow-400 ml-1">(incl. {failedRevives} failed)</span>
                    )}
                  </div>
                </div>
                <div className="sm:ml-auto text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold text-foreground">{totalAmountStr}</span>
                </div>
              </div>

              {/* Receipt Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Receipt Preview</label>
                <div className="bg-muted/10 border border-border rounded-lg p-4 flex flex-col">
                  <p className="text-sm whitespace-pre-wrap flex-1 text-foreground leading-relaxed">{receiptText}</p>
                  <div className="flex justify-end mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      onClick={handleCopyReceipt}
                      className="bg-muted/40 text-foreground border border-border hover:bg-muted"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
