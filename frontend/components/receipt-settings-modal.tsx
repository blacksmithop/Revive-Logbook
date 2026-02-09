"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { X, Save, Check, RotateCcw } from "lucide-react"
import {
  getReceiptSettings,
  saveReceiptSettings,
  getDefaultReceiptSettings,
  type ReceiptSettings,
} from "@/lib/indexeddb"
import { useToast } from "@/hooks/use-toast"

interface ReceiptSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const TEMPLATE_VARIABLES = [
  { variable: "{target}", description: "Target player name" },
  { variable: "{revives_done}", description: "Total revives in selection" },
  { variable: "{total_amount}", description: "Combined total: X Xanax or $Y" },
  { variable: "{successful_revives}", description: "Number of successful revives" },
  { variable: "{failed_revives}", description: "Number of failed revives" },
]

export function ReceiptSettingsModal({ isOpen, onClose }: ReceiptSettingsModalProps) {
  const { toast } = useToast()

  const [settings, setSettings] = useState<ReceiptSettings>(getDefaultReceiptSettings())
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getReceiptSettings().then((s) => {
        setSettings(s)
        setLoaded(true)
      })
      setSaved(false)
    } else {
      setLoaded(false)
    }
  }, [isOpen])

  const handleSave = async () => {
    try {
      await saveReceiptSettings(settings)
      setSaved(true)
      toast({ title: "Settings saved", description: "Your receipt settings have been saved." })
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast({ title: "Error", description: "Failed to save settings." })
    }
  }

  const handleReset = () => {
    setSettings(getDefaultReceiptSettings())
    toast({ title: "Reset", description: "Settings restored to defaults. Save to apply." })
  }

  const formatMoneyDisplay = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
    return `$${amount.toLocaleString()}`
  }

  if (!isOpen || !loaded) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 sm:pt-12">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Receipt Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-muted/50 hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
          {/* Pricing */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Default Pricing</h3>
            <p className="text-xs text-muted-foreground">
              Set the default price per revive. Set a value to <span className="font-medium text-foreground">0</span>{" "}
              to bill solely in the other currency.
            </p>
            <div className="text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2 border border-border">
              {settings.xanaxPerRevive > 0 && settings.moneyPerRevive > 0 && (
                <span>
                  Receipt shows: <span className="font-mono text-emerald-400">X Xanax or $Y</span>
                </span>
              )}
              {settings.xanaxPerRevive > 0 && settings.moneyPerRevive === 0 && (
                <span>
                  Receipt shows: <span className="font-mono text-emerald-400">X Xanax</span> only
                </span>
              )}
              {settings.xanaxPerRevive === 0 && settings.moneyPerRevive > 0 && (
                <span>
                  Receipt shows: <span className="font-mono text-emerald-400">$Y</span> only
                </span>
              )}
              {settings.xanaxPerRevive === 0 && settings.moneyPerRevive === 0 && (
                <span className="text-yellow-400">Both prices are 0. No amount will be shown.</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Xanax per revive</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.xanaxPerRevive}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, xanaxPerRevive: Number.parseFloat(e.target.value) || 0 }))
                    }
                    className="bg-muted/30 border-border text-foreground"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Xanax</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Money per revive</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="100000"
                    value={settings.moneyPerRevive}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, moneyPerRevive: Number.parseFloat(e.target.value) || 0 }))
                    }
                    className="bg-muted/30 border-border text-foreground"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    ({formatMoneyDisplay(settings.moneyPerRevive)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Template Variables Reference */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Template Variables</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/20">
                    <TableHead className="text-foreground text-xs py-2">Variable</TableHead>
                    <TableHead className="text-foreground text-xs py-2">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <TableRow key={v.variable} className="border-border">
                      <TableCell className="font-mono text-xs text-emerald-400 py-2">{v.variable}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">{v.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Template Editor */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Receipt Template</h3>
            <Textarea
              value={settings.template}
              onChange={(e) => setSettings((s) => ({ ...s, template: e.target.value }))}
              className="min-h-[140px] bg-muted/30 border-border font-mono text-sm text-foreground placeholder:text-muted-foreground"
              placeholder="Enter receipt template..."
            />
            <p className="text-xs text-muted-foreground">
              Example preview:{" "}
              <span className="italic text-foreground/70">
                {(() => {
                  const hasX = settings.xanaxPerRevive > 0
                  const hasM = settings.moneyPerRevive > 0
                  let amountStr = "0"
                  if (hasX && hasM) amountStr = `${5 * settings.xanaxPerRevive} Xanax or $${(5 * settings.moneyPerRevive).toLocaleString()}`
                  else if (hasX) amountStr = `${5 * settings.xanaxPerRevive} Xanax`
                  else if (hasM) amountStr = `$${(5 * settings.moneyPerRevive).toLocaleString()}`
                  return settings.template
                    .replace(/{target}/g, "PlayerName")
                    .replace(/{revives_done}/g, "5")
                    .replace(/{total_amount}/g, amountStr)
                    .replace(/{successful_revives}/g, "4")
                    .replace(/{failed_revives}/g, "1")
                })()}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to defaults
          </Button>
          <Button size="sm" onClick={handleSave}>
            {saved ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saved ? "Saved" : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}
