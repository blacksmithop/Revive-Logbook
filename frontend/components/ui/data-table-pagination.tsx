import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  itemName?: string
  isLoading?: boolean
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages]
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages]
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  itemName = "items",
  isLoading = false,
}: DataTablePaginationProps) {
  if (totalItems === 0) return null

  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalItems)
  const pages = getPageNumbers(currentPage, totalPages)
  const nav = "h-8 w-8 p-0 bg-transparent hover:bg-secondary"

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{startIndex}</span> to{" "}
        <span className="font-medium text-foreground">{endIndex}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> {itemName}
      </span>

      <nav className="tap-group flex items-center gap-1" aria-label="Pagination">
        <Button variant="outline" size="sm" className={nav} disabled={currentPage <= 1 || isLoading} onClick={() => onPageChange(1)} aria-label="First page">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className={nav} disabled={currentPage <= 1 || isLoading} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {pages.map((page, i) =>
          page === "..." ? (
            <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground select-none" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant="outline"
              size="sm"
              className={cn(nav, "text-xs", currentPage === page && "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20")}
              disabled={isLoading}
              onClick={() => onPageChange(page)}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </Button>
          ),
        )}

        <Button variant="outline" size="sm" className={nav} disabled={currentPage >= totalPages || isLoading} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className={nav} disabled={currentPage >= totalPages || isLoading} onClick={() => onPageChange(totalPages)} aria-label="Last page">
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </nav>
    </div>
  )
}
