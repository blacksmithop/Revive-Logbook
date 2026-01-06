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
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  XIcon,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { InteractionLogsModal } from "./interaction-logs-modal"
import { getAllPaymentStatuses, setPaymentStatus, saveExcludedFilters, getExcludedFilters } from "@/lib/indexeddb"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface RevivesTableProps {
  revives: EnrichedRevive[]
  onLoadMore: () => void
  isLoadingMore: boolean
  mode: "user" | "faction" // Added mode prop to distinguish user/faction API mode
  onPaymentStatusChange: (timestamp: number, targetId: number) => void
}

type SortField = "timestamp" | "skill" | "likelihood"
type SortDirection = "asc" | "desc"

export function RevivesTable({ revives, onLoadMore, isLoadingMore, mode, onPaymentStatusChange }: RevivesTableProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageJumpInput, setPageJumpInput] = useState("")

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [selectedTarget, setSelectedTarget] = useState<{ id: number; name: string } | null>(null)

  const [playerSearch, setPlayerSearch] = useState("")
  const [factionSearch, setFactionSearch] = useState("")

  const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set())
  const [excludedFactions, setExcludedFactions] = useState<Set<string>>(new Set())
  const [excludePlayerSearch, setExcludePlayerSearch] = useState("")
  const [excludeFactionSearch, setExcludeFactionSearch] = useState("")

  const [excludePlayerOpen, setExcludePlayerOpen] = useState(false)
  const [excludeFactionOpen, setExcludeFactionOpen] = useState(false)

  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const loadPaymentStatuses = async () => {
      const statuses = await getAllPaymentStatuses()
      setPaymentStatuses(statuses)
    }
    loadPaymentStatuses()
  }, [])

  useEffect(() => {
    const loadExcludedFilters = async () => {
      const filters = await getExcludedFilters()
      if (filters) {
        setExcludedPlayers(new Set(filters.players))
        setExcludedFactions(new Set(filters.factions))
      }
    }
    loadExcludedFilters()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, outcomeFilter, playerSearch, factionSearch, excludedPlayers, excludedFactions, dateRange])

  const togglePaymentStatus = async (timestamp: number, targetId: number) => {
    const id = `${timestamp}_${targetId}`
    const currentStatus = paymentStatuses[id] ?? false
    const newStatus = !currentStatus

    await setPaymentStatus(id, newStatus)
    setPaymentStatuses((prev) => ({ ...prev, [id]: newStatus }))
    onPaymentStatusChange(timestamp, targetId)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const uniquePlayers = useMemo(() => {
    const players = new Set<string>()
    revives.forEach((r) => {
      if (r.target.name) players.add(r.target.name)
    })
    return Array.from(players).sort()
  }, [revives])

  const uniqueFactions = useMemo(() => {
    const factions = new Set<string>()
    revives.forEach((r) => {
      if (r.target.faction?.name) factions.add(r.target.faction.name)
    })
    return Array.from(factions).sort()
  }, [revives])

  const filteredPlayersForExclude = useMemo(() => {
    let players = uniquePlayers
    if (excludePlayerSearch.trim()) {
      const searchLower = excludePlayerSearch.toLowerCase()
      players = players.filter((p) => p.toLowerCase().includes(searchLower))
    }
    return players.sort((a, b) => {
      const aExcluded = excludedPlayers.has(a)
      const bExcluded = excludedFactions.has(b)
      if (aExcluded && !bExcluded) return -1
      if (!aExcluded && bExcluded) return 1
      return a.localeCompare(b)
    })
  }, [uniquePlayers, excludePlayerSearch, excludedPlayers])

  const filteredFactionsForExclude = useMemo(() => {
    let factions = uniqueFactions
    if (excludeFactionSearch.trim()) {
      const searchLower = excludeFactionSearch.toLowerCase()
      factions = factions.filter((f) => f.toLowerCase().includes(searchLower))
    }
    return factions.sort((a, b) => {
      const aExcluded = excludedFactions.has(a)
      const bExcluded = excludedFactions.has(b)
      if (aExcluded && !bExcluded) return -1
      if (!aExcluded && bExcluded) return 1
      return a.localeCompare(b)
    })
  }, [uniqueFactions, excludeFactionSearch, excludedFactions])

  const toggleExcludePlayer = (player: string) => {
    const newSet = new Set(excludedPlayers)
    if (newSet.has(player)) {
      newSet.delete(player)
    } else {
      newSet.add(player)
    }
    setExcludedPlayers(newSet)
    saveExcludedFilters(Array.from(newSet), Array.from(excludedFactions))
  }

  const toggleExcludeFaction = (faction: string) => {
    const newSet = new Set(excludedFactions)
    if (newSet.has(faction)) {
      newSet.delete(faction)
    } else {
      newSet.add(faction)
    }
    setExcludedFactions(newSet)
    saveExcludedFilters(Array.from(excludedPlayers), Array.from(newSet))
  }

  const filteredAndSortedRevives = useMemo(() => {
    let filtered = [...revives]

    if (categoryFilter !== "all") {
      filtered = filtered.filter((r) => r.Category === categoryFilter)
    }

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

    if (excludedPlayers.size > 0) {
      filtered = filtered.filter((r) => !excludedPlayers.has(r.target.name))
    }

    if (excludedFactions.size > 0) {
      filtered = filtered.filter((r) => !r.target.faction?.name || !excludedFactions.has(r.target.faction.name))
    }

    if (dateRange.from) {
      const fromTimestamp = Math.floor(dateRange.from.getTime() / 1000)
      filtered = filtered.filter((r) => r.timestamp >= fromTimestamp)
    }
    if (dateRange.to) {
      const toTimestamp = Math.floor(dateRange.to.getTime() / 1000) + 86399
      filtered = filtered.filter((r) => r.timestamp <= toTimestamp)
    }

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
  }, [
    revives,
    categoryFilter,
    outcomeFilter,
    playerSearch,
    factionSearch,
    excludedPlayers,
    excludedFactions,
    dateRange,
    sortField,
    sortDirection,
  ])

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

  const handleFromDateSelect = (date: Date | undefined) => {
    setDateRange((prev) => ({ ...prev, from: date }))
  }

  const handleToDateSelect = (date: Date | undefined) => {
    setDateRange((prev) => ({ ...prev, to: date }))
  }

  const resetFilters = () => {
    setCategoryFilter("all")
    setOutcomeFilter("all")
    setDateRange({ from: undefined, to: undefined })
    setPlayerSearch("")
    setFactionSearch("")
    setExcludedPlayers(new Set())
    setExcludedFactions(new Set())
    setExcludePlayerSearch("")
    setExcludeFactionSearch("")
    setSortField("timestamp")
    setSortDirection("desc")
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
      case "RR":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
      case "Self Hosp":
        return "bg-pink-500/20 text-pink-400 border-pink-500/30"
      case "Casino":
        return "bg-teal-500/20 text-teal-400 border-teal-500/30"
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
      {sortField === field && sortDirection === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )}
    </button>
  )

  const handlePageJump = () => {
    const pageNum = Number(pageJumpInput)
    if (pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum)
      setPageJumpInput("")
    }
  }

  const handlePageJumpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageJump()
    }
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Search Player, Search Faction, Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Search Player</label>
          <Input
            placeholder="Player name..."
            value={playerSearch}
            className="bg-transparent"
            onChange={(e) => setPlayerSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Search Faction</label>
          <Input
            placeholder="Faction name..."
            value={factionSearch}
            className="bg-transparent"
            onChange={(e) => setFactionSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Date Range</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start bg-transparent text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? format(dateRange.from, "PPP") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.from} onSelect={handleFromDateSelect} initialFocus />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start bg-transparent text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.to ? format(dateRange.to, "PPP") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.to} onSelect={handleToDateSelect} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Row 2: Category, Outcome, Clear Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PvP">PvP</SelectItem>
              <SelectItem value="OD">OD</SelectItem>
              <SelectItem value="Crime">Crime</SelectItem>
              <SelectItem value="RR">RR</SelectItem>
              <SelectItem value="Self Hosp">Self Hosp</SelectItem>
              <SelectItem value="Casino">Casino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Outcome</label>
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button variant="outline" onClick={resetFilters} className="bg-transparent h-10">
            Reset
          </Button>
        </div>
      </div>

      {/* Row 3: Exclude Players, Exclude Factions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Exclude Players ({excludedPlayers.size})</label>
          <DropdownMenu
            open={excludePlayerOpen}
            onOpenChange={(open) => {
              setExcludePlayerOpen(open)
              if (!open) {
                setExcludePlayerSearch("")
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                {excludedPlayers.size > 0 ? `${excludedPlayers.size} excluded` : "Select players..."}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" align="start">
              <div className="p-2 sticky top-0 bg-background">
                <Input
                  placeholder="Search players..."
                  value={excludePlayerSearch}
                  onChange={(e) => setExcludePlayerSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="p-2 space-y-1">
                {filteredPlayersForExclude.length > 0 ? (
                  filteredPlayersForExclude.map((player) => (
                    <div
                      key={player}
                      className="flex items-center space-x-2 py-1 px-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => toggleExcludePlayer(player)}
                    >
                      <Checkbox checked={excludedPlayers.has(player)} />
                      <span className="text-sm">{player}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">No players found</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Exclude Factions ({excludedFactions.size})</label>
          <DropdownMenu
            open={excludeFactionOpen}
            onOpenChange={(open) => {
              setExcludeFactionOpen(open)
              if (!open) {
                setExcludeFactionSearch("")
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                {excludedFactions.size > 0 ? `${excludedFactions.size} excluded` : "Select factions..."}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" align="start">
              <div className="p-2 sticky top-0 bg-background">
                <Input
                  placeholder="Search factions..."
                  value={excludeFactionSearch}
                  onChange={(e) => setExcludeFactionSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="p-2 space-y-1">
                {filteredFactionsForExclude.length > 0 ? (
                  filteredFactionsForExclude.map((faction) => (
                    <div
                      key={faction}
                      className="flex items-center space-x-2 py-1 px-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => toggleExcludeFaction(faction)}
                    >
                      <Checkbox checked={excludedFactions.has(faction)} />
                      <span className="text-sm">{faction}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">No factions found</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {mode === "faction" && <TableHead className="px-4 py-3 text-left font-medium">Reviver</TableHead>}
                <TableHead className="px-4 py-3 text-left font-medium">
                  <SortButton field="skill">Skill</SortButton>
                </TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">
                  <SortButton field="likelihood">Likelihood</SortButton>
                </TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">Target</TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">Faction</TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">Hospitalized By</TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">Outcome</TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">
                  <SortButton field="timestamp">Timestamp</SortButton>
                </TableHead>
                <TableHead className="px-4 py-3 text-left font-medium">Payment</TableHead>
                {mode === "user" && <TableHead className="px-4 py-3 text-left font-medium">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRevives.map((revive, idx) => {
                const paymentId = `${revive.timestamp}_${revive.target.id}`
                const isPaid = paymentStatuses[paymentId] ?? false

                return (
                  <TableRow
                    key={revive.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                    )}
                  >
                    {mode === "faction" && (
                      <TableCell className="px-4 py-3">
                        <a
                          href={`https://www.torn.com/profiles.php?XID=${revive.reviver.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-primary transition-colors"
                        >
                          {revive.reviver.name}
                        </a>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3 text-sm">
                      <span className="text-emerald-400 font-mono">{revive.reviver.skill?.toFixed(2) || "-"}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={getLikelihoodColor(revive.Likelihood)}>
                        {revive.Chance}%
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${revive.target.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {revive.target.name}
                      </a>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[150px]">
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
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(revive.Category)}>
                          {revive.Category}
                        </Badge>
                        <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {revive.HospitalizedBy || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {revive.Success ? (
                        <ArrowUp className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(revive.timestamp)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
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
                        {isPaid ? <DollarSign className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    {mode === "user" && (
                      <TableCell className="px-4 py-3">
                        <button
                          onClick={() => setSelectedTarget({ id: revive.target.id, name: revive.target.name })}
                          className="p-2 hover:bg-muted rounded-md transition-colors"
                          title="View interaction logs"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedRevives.map((revive) => {
          const paymentId = `${revive.timestamp}_${revive.target.id}`
          const isPaid = paymentStatuses[paymentId] ?? false

          return (
            <Card key={revive.id} className="bg-card/50">
              <CardContent className="p-4 space-y-3">
                {mode === "faction" && (
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="text-xs text-muted-foreground">Reviver</span>
                    <a
                      href={`https://www.torn.com/profiles.php?XID=${revive.reviver.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {revive.reviver.name}
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Skill</span>
                  <span className="text-emerald-400 font-mono text-sm">{revive.reviver.skill?.toFixed(2) || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Likelihood</span>
                  <Badge variant="outline" className={getLikelihoodColor(revive.Likelihood)}>
                    {revive.Chance}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Target</span>
                  <a
                    href={`https://www.torn.com/profiles.php?XID=${revive.target.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {revive.target.name}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Faction</span>
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
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
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hospitalized By</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getCategoryColor(revive.Category)}>
                      {revive.Category}
                    </Badge>
                    <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {revive.HospitalizedBy || "-"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Outcome</span>
                  <span className="text-sm">
                    {revive.Success ? (
                      <ArrowUp className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ArrowDown className="text-destructive" />
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Timestamp</span>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(revive.timestamp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Payment</span>
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
                    {isPaid ? <DollarSign className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "user" && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Actions</span>
                    <button
                      onClick={() => setSelectedTarget({ id: revive.target.id, name: revive.target.name })}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      title="View interaction logs"
                    >
                      <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              title="Go to first page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                onKeyDown={handlePageJumpKeyDown}
                placeholder="Go to"
                className="w-16 h-8 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePageJump}
                disabled={!pageJumpInput || Number(pageJumpInput) < 1 || Number(pageJumpInput) > totalPages}
                title="Go to page"
              >
                Go
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              title="Go to last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

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
      </div>

      {mode === "user" && selectedTarget && (
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
