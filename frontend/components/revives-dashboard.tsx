"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RevivesTable } from "./revives-table"
import { enrichRevives, type EnrichedRevive } from "@/lib/revive-enrichment"
import {
  getApiKey,
  getApiMode,
  saveRevives,
  getAllRevives,
  getOldestTimestamp,
  clearApiKey,
  clearAllData,
} from "@/lib/indexeddb"
import { Loader2, RefreshCw, LogOut, ChevronDown, Download, Receipt, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"
import { ReceiptModal } from "./receipt-modal"
import { ReceiptSettingsModal } from "./receipt-settings-modal"

interface RevivesDashboardProps {
  onLogout: () => void
}

export function RevivesDashboard({ onLogout }: RevivesDashboardProps) {
  const [revives, setRevives] = useState<EnrichedRevive[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [userReviveId, setUserReviveId] = useState<number>(0)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [mode, setMode] = useState<"user" | "faction">("user")
  const [factionId, setFactionId] = useState<number>(0)
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showReceiptSettings, setShowReceiptSettings] = useState(false)
  const { toast } = useToast()
  const filteredRevivesRef = useRef<EnrichedRevive[]>([])

  const [filteredCount, setFilteredCount] = useState(0)

  const handleFilteredRevivesChange = useCallback((filtered: EnrichedRevive[]) => {
    filteredRevivesRef.current = filtered
    setFilteredCount(filtered.length)
  }, [])

  const fetchRevives = async (backfill = false) => {
    if (backfill) {
      setIsLoadingMore(true)
    } else {
      setIsFetching(true)
    }
    setError("")

    try {
      const apiKey = await getApiKey()
      if (!apiKey) {
        onLogout()
        return
      }

      const currentMode = await getApiMode()
      setMode(currentMode)

      const baseUrl =
        currentMode === "user"
          ? "https://api.torn.com/v2/user/revives?filters=outgoing&limit=100&striptags=true"
          : "https://api.torn.com/v2/faction/revives?filters=outgoing&limit=100&sort=DESC&striptags=true"

      let url = baseUrl

      if (backfill) {
        const oldestTimestamp = await getOldestTimestamp(currentMode)
        if (oldestTimestamp) {
          url += `&to=${oldestTimestamp}`
        }
      }

      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch revives")
      }

      const data = await response.json()
      const fetchedRevives = data.revives || []

      if (backfill && fetchedRevives.length === 0) {
        setHasMoreData(false)
      }

      if (fetchedRevives.length > 0) {
        if (!userReviveId && fetchedRevives[0]?.reviver?.id) {
          setUserReviveId(fetchedRevives[0].reviver.id)
        }
        if (!factionId && fetchedRevives[0]?.reviver?.faction?.id) {
          setFactionId(fetchedRevives[0].reviver.faction.id)
        }

        await saveRevives(fetchedRevives, currentMode)

        const allRevives = await getAllRevives(currentMode)
        const enriched = enrichRevives(allRevives, fetchedRevives[0]?.reviver?.id || userReviveId)
        setRevives(enriched)

        if (backfill) {
          toast({
            title: "Loaded more revives",
            description: `Fetched ${fetchedRevives.length} revives. Total: ${allRevives.length}`,
          })
        } else {
          toast({
            title: "Revives refreshed",
            description: `Loaded ${fetchedRevives.length} latest revives.`,
          })
        }
      } else if (backfill) {
        setHasMoreData(false)
        toast({
          title: "No more data",
          description: "All available revives have been loaded.",
        })
      }
    } catch (err) {
      setError("Failed to fetch revives. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
      setIsLoadingMore(false)
    }
  }

  const loadFromCache = async () => {
    try {
      const currentMode = await getApiMode()
      setMode(currentMode)

      const cachedRevives = await getAllRevives(currentMode)
      if (cachedRevives.length > 0) {
        const enriched = enrichRevives(cachedRevives, cachedRevives[0]?.reviver?.id || 0)
        setRevives(enriched)
        if (cachedRevives[0]?.reviver?.id) {
          setUserReviveId(cachedRevives[0].reviver.id)
        }
        if (cachedRevives[0]?.reviver?.faction?.id) {
          setFactionId(cachedRevives[0].reviver.faction.id)
        }
      }
    } catch (err) {
      console.error("Failed to load cached revives:", err)
    }
  }

  useEffect(() => {
    loadFromCache().then(() => fetchRevives())
  }, [])

  const handleRefresh = () => {
    setHasMoreData(true)
    fetchRevives(false)
  }

  const handleLoadMore = () => {
    fetchRevives(true)
  }

  const handleLogout = async () => {
    try {
      await clearApiKey()
      toast({
        title: "Logged out",
        description: "Your API key has been cleared.",
      })
      onLogout()
    } catch (err) {
      console.error("Failed to clear API key:", err)
    }
  }

  const handleClearAllData = async () => {
    setShowClearDataConfirm(false)
    try {
      await clearAllData()
      toast({
        title: "All data cleared",
        description: "API key, cached revives, payment statuses, and filters have been removed.",
      })
      onLogout()
    } catch (err) {
      console.error("Failed to clear all data:", err)
    }
  }

  const handleExportClick = () => {
    if (revives.length === 0) {
      toast({ title: "No data", description: "No revives to export." })
      return
    }
    setShowExportConfirm(true)
  }

  const handleExportToExcel = async (useFilters: boolean) => {
    setShowExportConfirm(false)

    const sourceRevives = useFilters ? filteredRevivesRef.current : revives
    if (sourceRevives.length === 0) {
      toast({ title: "No data", description: "No revives match the current filters." })
      return
    }

    const { getAllPaymentStatuses } = await import("@/lib/indexeddb")
    const paymentStatuses = await getAllPaymentStatuses()

    const sortedRevives = [...sourceRevives].sort((a, b) => b.timestamp - a.timestamp)

    // Prepare data rows based on mode
    const data = sortedRevives.map((revive) => {
      const timestamp = new Date(revive.timestamp * 1000).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      const outcome = revive.Success ? "Success" : "Failed"
      const paymentId = `${revive.timestamp}_${revive.target.id}`
      const paymentStatus = paymentStatuses[paymentId] ? "Paid" : "Unpaid"
      const reviveChance = `${revive.Chance.toFixed(2)}%`

      if (mode === "user") {
        return {
          Target: revive.target.name,
          "Target Faction": revive.target.faction?.name || "N/A",
          "Hospitalized By": revive.HospitalizedBy || "N/A",
          Category: revive.Category || "N/A",
          Skill: revive.reviver.skill?.toFixed(2) || "N/A",
          "Revive Chance": reviveChance,
          Outcome: outcome,
          Timestamp: timestamp,
          Payment: paymentStatus,
        }
      } else {
        return {
          Reviver: revive.reviver.name,
          "Reviver ID": revive.reviver.id,
          Target: revive.target.name,
          "Target Faction": revive.target.faction?.name || "N/A",
          "Hospitalized By": revive.HospitalizedBy || "N/A",
          Category: revive.Category || "N/A",
          Skill: revive.reviver.skill?.toFixed(2) || "N/A",
          "Revive Chance": reviveChance,
          Outcome: outcome,
          Timestamp: timestamp,
          Payment: paymentStatus,
        }
      }
    })

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Set column widths for better readability
    const columnWidths =
      mode === "user"
        ? [
            { wch: 18 }, // Target
            { wch: 20 }, // Target Faction
            { wch: 25 }, // Hospitalized By
            { wch: 12 }, // Category
            { wch: 8 }, // Skill
            { wch: 12 }, // Revive Chance
            { wch: 10 }, // Outcome
            { wch: 20 }, // Timestamp
            { wch: 10 }, // Payment
          ]
        : [
            { wch: 18 }, // Reviver
            { wch: 12 }, // Reviver ID
            { wch: 18 }, // Target
            { wch: 20 }, // Target Faction
            { wch: 25 }, // Hospitalized By
            { wch: 12 }, // Category
            { wch: 8 }, // Skill
            { wch: 12 }, // Revive Chance
            { wch: 10 }, // Outcome
            { wch: 20 }, // Timestamp
            { wch: 10 }, // Payment
          ]

    worksheet["!cols"] = columnWidths

    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Revives")

    // Generate filename
    const now = new Date()
    const day = String(now.getDate()).padStart(2, "0")
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = now.getFullYear()
    const uuid = crypto.randomUUID().split("-")[0]

    const id = mode === "user" ? userReviveId : factionId
    const filename = `${id}_revives_${day}${month}${year}_${uuid}.xlsx`

    // Write to binary string and create blob for browser download
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })

    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export complete",
      description: `Exported ${sortedRevives.length} revives${useFilters ? " (filtered)" : ""} to ${filename}`,
    })
  }

  const handleClearApiKey = async () => {
    await handleLogout()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 p-3 sm:p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl">
                    Torn Revives Tracker {mode === "faction" && "(Faction)"}
                  </CardTitle>
                  <CardDescription className="text-sm">Tracking {revives.length} revives</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReceiptSettings(true)}
                    className="px-3 bg-transparent"
                    title="Receipt Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReceiptModal(true)}
                    disabled={revives.length === 0}
                    className="flex-1 sm:flex-initial bg-transparent"
                  >
                    <Receipt className="w-4 h-4 mr-1" />
                    Receipt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportClick}
                    disabled={revives.length === 0}
                    className="flex-1 sm:flex-initial bg-transparent"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                  <div className="flex-1 sm:flex-initial relative group">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore || isFetching || !hasMoreData}
                      className="w-full bg-transparent"
                    >
                      {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
                    </Button>
                    {!hasMoreData && (
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg whitespace-nowrap border z-50">
                        No more data available
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching || isLoadingMore}
                    className="px-3 bg-transparent"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-3 bg-transparent">
                        <LogOut className="w-4 h-4 mr-1" />
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleClearAllData} className="text-destructive">
                        Logout & Clear Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-3">
              {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : revives.length > 0 ? (
                <RevivesTable revives={revives} onLoadMore={handleLoadMore} isLoadingMore={isLoadingMore} mode={mode} onFilteredRevivesChange={handleFilteredRevivesChange} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">No revives found</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showClearDataConfirm} onOpenChange={setShowClearDataConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Data</DialogTitle>
            <DialogDescription>
              This will permanently remove your API key, all cached revives, payment statuses, and saved filters. Are
              you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClearDataConfirm(false)}
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearAllData}>
              Clear All & Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Revives</DialogTitle>
            <DialogDescription>
              You have {revives.length} total revives and {filteredCount} after applying filters.
              Would you like to export with the current filters applied?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleExportToExcel(false)} className="bg-transparent">
              Export All ({revives.length})
            </Button>
            <Button onClick={() => handleExportToExcel(true)}>
              Export Filtered ({filteredCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        revives={revives}
        mode={mode}
      />

      <ReceiptSettingsModal
        isOpen={showReceiptSettings}
        onClose={() => setShowReceiptSettings(false)}
      />

      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        Created by{" "}
        <a
          href="https://www.torn.com/profiles.php?XID=1712955"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/90 hover:text-white font-semibold transition-colors"
        >
          Oxiblurr [1712955]
        </a>
      </footer>
    </div>
  )
}
