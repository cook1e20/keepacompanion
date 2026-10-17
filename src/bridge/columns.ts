import { badgeFor } from '../lib/gating.js';
import { googleSearchUrl } from '../lib/search.js';
import { formatAge, formatStamp, STATUS_LABELS, STATUS_SHORT } from '../lib/tracker.js';
import { TRACK_STATUSES, type TrackStatus } from '../lib/types.js';
import {
  ensureGating,
  ensureTracker,
  gatingFor,
  onRepaint,
  setStatus,
  stampSearched,
  trackerFor,
} from './store.js';

export const KC_COLUMN_IDS = ['kc_status', 'kc_searched', 'kc_gating', 'kc_search'] as const;

interface CellParams {
  data?: ({ asin?: string } & Record<string, unknown>) | undefined;
}

/**
 * UNVERIFIED: the title/brand field names on Keepa's finder row data have not
 * been captured from a live page. Candidates are tried in order; this is the
 * only place that reads them. Once the operator confirms the real names
 * (devtools: inspect `params.data` on a row), trim these lists and record them
 * in CLAUDE.md. A missing field degrades to a title-only query, or a disabled
 * button when neither is found.
 */
const TITLE_FIELDS = ['title', 'productTitle'] as const;
const BRAND_FIELDS = ['brand', 'manufacturer'] as const;

function firstString(data: CellParams['data'], fields: readonly string[]): string | undefined {
  if (!data) return undefined;
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function searchUrlFor(data: CellParams['data']): string | null {
  return googleSearchUrl(firstString(data, BRAND_FIELDS), firstString(data, TITLE_FIELDS));
}

interface PaintEntry {
  asin: string;
  paint: () => void;
}

/**
 * Live renderer instances keyed by asin. ag-Grid recycles cells as the
 * viewport moves, so paint targets are tracked here rather than by row index.
 */
const live = new Map<string, Set<PaintEntry>>();

function register(entry: PaintEntry): void {
  let set = live.get(entry.asin);
  if (!set) live.set(entry.asin, (set = new Set()));
  set.add(entry);
}

function unregister(entry: PaintEntry): void {
  const set = live.get(entry.asin);
  if (!set) return;
  set.delete(entry);
  if (set.size === 0) live.delete(entry.asin);
}

onRepaint((asins) => {
  for (const asin of asins) {
    for (const entry of live.get(asin) ?? []) entry.paint();
  }
});

// ---------- viewport-driven batching ----------
//
// A renderer is only constructed for a row ag-Grid actually paints, so
// collecting asins here follows the viewport for free. The short debounce
// turns one scroll into one request instead of fourteen.

const pendingTracker = new Set<string>();
const pendingGating = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function queue(asin: string, wantGating: boolean): void {
  pendingTracker.add(asin);
  if (wantGating) pendingGating.add(asin);
  if (flushTimer !== undefined) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    const tracker = [...pendingTracker];
    const gating = [...pendingGating];
    pendingTracker.clear();
    pendingGating.clear();
    void ensureTracker(tracker);
    void ensureGating(gating);
  }, 150);
}

function cell(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `kc-cell ${className}`;
  return el;
}

/**
 * ag-Grid 21 takes a cell renderer as a constructor with an init/getGui/
 * destroy/refresh prototype. Each renderer below builds its DOM once and
 * repaints in place, so a store update never rebuilds the cell.
 */
abstract class BaseRenderer {
  protected eGui: HTMLElement = cell('');
  protected asin: string | null = null;
  private entry: PaintEntry | null = null;

  protected abstract className: string;
  protected abstract build(): void;
  protected abstract paint(): void;
  protected abstract wantsGating: boolean;

  init(params: CellParams): void {
    this.eGui = cell(this.className);
    this.asin = params.data?.asin ?? null;
    // Rows arrive empty first in Keepa's paged row model; ag-Grid rebuilds
    // the cell once the page lands, so an empty shell is correct here.
    if (!this.asin) return;

    this.build();
    this.entry = { asin: this.asin, paint: () => this.paint() };
    register(this.entry);
    this.paint();
    queue(this.asin, this.wantsGating);
  }

  getGui(): HTMLElement {
    return this.eGui;
  }

  destroy(): void {
    if (this.entry) unregister(this.entry);
    this.entry = null;
  }

  refresh(): boolean {
    return false;
  }
}

class StatusRenderer extends BaseRenderer {
  protected className = 'kc-status';
  protected wantsGating = false;
  private buttons = new Map<TrackStatus, HTMLButtonElement>();

  protected build(): void {
    for (const status of TRACK_STATUSES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `kc-btn kc-btn-${status}`;
      button.textContent = STATUS_SHORT[status];
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const asin = this.asin;
        if (!asin) return;
        const held = trackerFor(asin).status;
        void setStatus(asin, held === status ? null : status);
      });
      this.buttons.set(status, button);
      this.eGui.append(button);
    }
  }

  protected paint(): void {
    if (!this.asin) return;
    const row = trackerFor(this.asin);
    for (const [status, button] of this.buttons) {
      const on = row.status === status;
      button.classList.toggle('kc-on', on);
      button.title = on
        ? `${STATUS_LABELS[status]} — set ${formatStamp(row.status_at)} (click to clear)`
        : STATUS_LABELS[status];
    }
  }
}

class SearchedRenderer extends BaseRenderer {
  protected className = 'kc-searched';
  protected wantsGating = false;
  private button = document.createElement('button');

  protected build(): void {
    this.button.type = 'button';
    this.button.className = 'kc-searched-btn';
    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.asin) void stampSearched(this.asin);
    });
    this.eGui.append(this.button);
  }

  protected paint(): void {
    if (!this.asin) return;
    const row = trackerFor(this.asin);
    this.button.textContent = formatAge(row.last_searched_at);
    this.button.classList.toggle('kc-never', !row.last_searched_at);
    this.button.title = `${formatStamp(row.last_searched_at)} — click to stamp today`;
  }
}

class SearchRenderer extends BaseRenderer {
  protected className = 'kc-search';
  protected wantsGating = false;
  private button = document.createElement('button');
  private url: string | null = null;

  override init(params: CellParams): void {
    this.url = searchUrlFor(params.data);
    super.init(params);
  }

  protected build(): void {
    this.button.type = 'button';
    this.button.className = 'kc-btn kc-search-btn';
    this.button.textContent = 'G';
    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!this.url || !this.asin) return;
      window.open(this.url, '_blank', 'noopener');
      void stampSearched(this.asin);
    });
    this.eGui.append(this.button);
  }

  protected paint(): void {
    this.button.disabled = !this.url;
    this.button.title = this.url
      ? 'Search Google UK for brand + title (stamps Searched)'
      : 'No title on this row to search for';
  }
}

class GatingRenderer extends BaseRenderer {
  protected className = 'kc-gating';
  protected wantsGating = true;
  private badge = document.createElement('span');

  protected build(): void {
    this.badge.className = 'kc-badge';
    this.eGui.append(this.badge);
  }

  protected paint(): void {
    if (!this.asin) return;
    const { text, cls, title } = badgeFor(gatingFor(this.asin));
    this.badge.textContent = text;
    this.badge.className = `kc-badge ${cls}`;
    this.badge.title = title;
  }
}

/**
 * Value getters exist for Keepa's Excel export, which reads cell values
 * rather than rendered DOM.
 */
export function companionColumnDefs(): unknown[] {
  const base = {
    // Explicit, because Keepa's own defs default to hidden across its ~580
    // columns. forceVisible() in bridge.ts handles the saved-state restore
    // that would otherwise re-hide these.
    hide: false,
    pinned: 'right',
    sortable: false,
    filter: false,
    resizable: true,
    suppressMenu: true,
    lockPinned: true,
    cellClass: 'kc-ag-cell',
  };

  return [
    {
      ...base,
      colId: 'kc_status',
      headerName: 'Track',
      headerTooltip: 'Checked / Bought / Near miss / Pass — per ASIN, shared across every filter',
      width: 150,
      minWidth: 150,
      cellRenderer: StatusRenderer,
      valueGetter: (p: CellParams) => {
        const asin = p.data?.asin;
        return asin ? (trackerFor(asin).status ?? '') : '';
      },
    },
    {
      ...base,
      colId: 'kc_searched',
      headerName: 'Searched',
      headerTooltip: 'Age of the last manual search for this ASIN — click the cell to stamp today',
      width: 84,
      minWidth: 70,
      cellRenderer: SearchedRenderer,
      valueGetter: (p: CellParams) => {
        const asin = p.data?.asin;
        return asin ? (trackerFor(asin).last_searched_at ?? '') : '';
      },
    },
    {
      ...base,
      colId: 'kc_gating',
      headerName: 'Gate',
      headerTooltip: 'UK listing restriction for your seller account, via SP-API',
      width: 70,
      minWidth: 60,
      cellRenderer: GatingRenderer,
      valueGetter: (p: CellParams) => {
        const asin = p.data?.asin;
        if (!asin) return '';
        const row = gatingFor(asin);
        if (!row || row.gated === null) return '';
        return row.gated ? 'GATED' : 'OK';
      },
    },
    {
      ...base,
      colId: 'kc_search',
      headerName: 'Search',
      headerTooltip: 'Google UK search on brand + title — also stamps Searched',
      width: 64,
      minWidth: 56,
      cellRenderer: SearchRenderer,
      valueGetter: () => '',
    },
  ];
}
