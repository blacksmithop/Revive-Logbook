"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import type { EnrichedRevive } from "@/lib/revive-enrichment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ArrowUpDown, Check, CalendarIcon, ChevronLeft, ChevronRight, Eye, DollarSign, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { InteractionLogsModal } from "./interaction-logs-modal"
import { savePaymentStatus, getAllPaymentStatuses } from "@/lib/indexeddb"

interface RevivesTableProps {
  revives: EnrichedRevive[]
  onLoadMore: () => void
  isLoadingMore: boolean
}

type SortField = "timestamp" | "skill" | "likelihood"
type SortDirection = "asc" | "desc"

export function RevivesTable({ revives, onLoadMore, isLoadingMore }: RevivesTableProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  const [selectedTarget, setSelectedTarget] = useState<{ id: number; name: string } | null>(null)

  const [playerSearch, setPlayerSearch] = useState("")
  const [factionSearch, setFactionSearch] = useState("")

  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const loadPaymentStatuses = async () => {
      const statuses = await getAllPaymentStatuses()
      setPaymentStatuses(statuses)
    }
    loadPaymentStatuses()
  }, [])

  const togglePaymentStatus = async (timestamp: number, targetId: number) => {
    const id = `${timestamp}_${targetId}`
    const currentStatus = paymentStatuses[id] ?? false
    const newStatus = !currentStatus

    await savePaymentStatus(timestamp, targetId, newStatus)
    setPaymentStatuses((prev) => ({ ...prev, [id]: newStatus }))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const filteredAndSortedRevives = useMemo(() => {
    let filtered = [...revives]

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((r) => r.Category === categoryFilter)
    }

    // Outcome filter
    if (outcomeFilter !== "all") {
      const isSuccess = outcomeFilter === "success"
      filtered = filtered.filter((r) => r.Success === isSuccess)
    }

    if (playerSearch.trim()) {
      const searchLower = playerSearch.toLowerCase()
      filtered = filtered.filter((r) => r.target.name.toLowerCase().includes(searchLower))
    }

    if (factionSearch.trim()) {
      const searchLower = factionSearch.toLowerCase()
      filtered = filtered.filter((r) => r.target.faction?.name.toLowerCase().includes(searchLower))
    }

    // Date range filter
    if (dateFrom) {
      const fromTimestamp = Math.floor(dateFrom.getTime() / 1000)
      filtered = filtered.filter((r) => r.timestamp >= fromTimestamp)
    }
    if (dateTo) {
      const toTimestamp = Math.floor(dateTo.getTime() / 1000) + 86399
      filtered = filtered.filter((r) => r.timestamp <= toTimestamp)
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "timestamp":
          comparison = a.timestamp - b.timestamp
          break
        case "skill":
          comparison = (a.reviver.skill || 0) - (b.reviver.skill || 0)
          break
        case "likelihood":
          comparison = a.Chance - b.Chance
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [revives, categoryFilter, outcomeFilter, playerSearch, factionSearch, dateFrom, dateTo, sortField, sortDirection])

  const totalPages = Math.ceil(filteredAndSortedRevives.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedRevives = filteredAndSortedRevives.slice(startIndex, endIndex)

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)

    if (newPage === totalPages && !isLoadingMore) {
      onLoadMore()
    }
  }

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize))
    setCurrentPage(1)
  }

  const getLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
      case "Very High":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "High":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "Medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "Low":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "PvP":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "OD":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "Crime":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
        <div className="flex gap-3 flex-1 min-w-full sm:min-w-[300px]">
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Search Player</label>
            <Input
              placeholder="Player name..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Search Faction</label>
            <Input
              placeholder="Faction name..."
              value={factionSearch}
              onChange={(e) => setFactionSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-w-full sm:min-w-[200px] space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MM/dd/yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MM/dd/yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-3 flex-1">
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PvP">PvP</SelectItem>
                <SelectItem value="OD">OD</SelectItem>
                <SelectItem value="Crime">Crime</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Outcome</label>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setCategoryFilter("all")
            setOutcomeFilter("all")
            setDateFrom(undefined)
            setDateTo(undefined)
            setPlayerSearch("")
            setFactionSearch("")
          }}
          className="w-full sm:w-auto"
        >
          Clear Filters
        </Button>
      </div>

      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">
                  <SortButton field="skill">Skill</SortButton>
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  <SortButton field="likelihood">Likelihood</SortButton>
                </th>
                <th className="px-4 py-3 text-left font-medium">Target</th>
                <th className="px-4 py-3 text-left font-medium">Faction</th>
                <th className="px-4 py-3 text-left font-medium">Hospitalized By</th>
                <th className="px-4 py-3 text-left font-medium">Outcome</th>
                <th className="px-4 py-3 text-left font-medium">
                  <SortButton field="timestamp">Timestamp</SortButton>
                </th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRevives.map((revive, idx) => {
                const paymentId = `${revive.timestamp}_${revive.target.id}`
                const isPaid = paymentStatuses[paymentId] ?? false

                return (
                  <tr
                    key={revive.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                    )}
                  >
                    <td className="px-4 py-3 text-sm">
                      <span className="text-emerald-400 font-mono">{revive.reviver.skill?.toFixed(2) || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={getLikelihoodColor(revive.Likelihood)}>
                        {revive.Chance}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${revive.target.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {revive.target.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[150px]">
                      {revive.target.faction ? (
                        <a
                          href={`https://www.torn.com/factions.php?step=profile&ID=${revive.target.faction.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground transition-colors"
                        >
                          {revive.target.faction.name}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(revive.Category)}>
                          {revive.Category}
                        </Badge>
                        <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {revive.HospitalizedBy || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {revive.Success ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <span className="text-destructive">✕</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(revive.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePaymentStatus(revive.timestamp, revive.target.id)}
                        className={cn(
                          "p-2 rounded-md transition-colors",
                          isPaid
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                        )}
                        title={isPaid ? "Paid" : "Not Paid"}
                      >
                        {isPaid ? <DollarSign className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedTarget({ id: revive.target.id, name: revive.target.name })}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                        title="View interaction logs"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {paginatedRevives.map((revive) => {
          const paymentId = `${revive.timestamp}_${revive.target.id}`
          const isPaid = paymentStatuses[paymentId] ?? false

          return (
            <div key={revive.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://www.torn.com/profiles.php?XID=${revive.target.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold hover:text-primary transition-colors block truncate"
                  >
                    {revive.target.name}
                  </a>
                  {revive.target.faction && (
                    <a
                      href={`https://www.torn.com/factions.php?step=profile&ID=${revive.target.faction.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block truncate"
                    >
                      {revive.target.faction.name}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePaymentStatus(revive.timestamp, revive.target.id)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400",
                    )}
                  >
                    {isPaid ? <DollarSign className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  {revive.Success ? (
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <span className="text-destructive text-xl flex-shrink-0">✕</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getCategoryColor(revive.Category)}>
                  {revive.Category}
                </Badge>
                <Badge variant="outline" className={getLikelihoodColor(revive.Likelihood)}>
                  {revive.Chance}%
                </Badge>
                <Badge variant="outline" className="bg-muted/50">
                  Skill: {revive.reviver.skill?.toFixed(2) || "-"}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                {revive.HospitalizedBy && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[100px]">Hospitalized:</span>
                    <span className="text-foreground">{revive.HospitalizedBy}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[100px]">Time:</span>
                  <span className="text-foreground">{formatTimestamp(revive.timestamp)}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTarget({ id: revive.target.id, name: revive.target.name })}
                className="w-full flex items-center justify-center gap-2 p-2 hover:bg-muted rounded-md transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                View Interaction Logs
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {selectedTarget && (
        <InteractionLogsModal
          isOpen={!!selectedTarget}
          onClose={() => setSelectedTarget(null)}
          targetId={selectedTarget.id}
          targetName={selectedTarget.name}
        />
      )}
    </div>
  )
}
