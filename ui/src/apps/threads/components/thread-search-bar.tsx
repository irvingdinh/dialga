import { LoaderIcon, SearchIcon, XIcon } from "lucide-react";

interface ThreadSearchBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onToggleSearch: () => void;
  onClearSearch: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isSearchLoading: boolean;
  hasSearchQuery: boolean;
}

export function ThreadSearchBar({
  searchInput,
  onSearchInputChange,
  onToggleSearch,
  onClearSearch,
  searchInputRef,
  isSearchLoading,
  hasSearchQuery,
}: ThreadSearchBarProps) {
  return (
    <div className="border-b px-4 py-2">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <SearchIcon className="text-muted-foreground size-4 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onToggleSearch();
          }}
          placeholder="Search messages..."
          className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
        />
        {searchInput && (
          <button
            type="button"
            onClick={onClearSearch}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
        {isSearchLoading && hasSearchQuery && (
          <LoaderIcon className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
        )}
      </div>
    </div>
  );
}
