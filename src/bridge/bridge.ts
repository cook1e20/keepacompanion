import { asinFromKeepaHref } from '../lib/asin.js';
import { companionColumnDefs, KC_COLUMN_IDS } from './columns.js';
import { stampSearched } from './store.js';

/**
 * MAIN-world bridge.
 *
 * Keepa's Product Finder is an ag-Grid Enterprise 21.1.0 grid and keeps its
 * `gridOptions` in module scope — nothing is exposed on `window`. The only
 * reliable handle is the constructor itself: `grid.js` runs
 * `new agGrid.Grid(el, gridOptions)` after loading ag-Grid from a dynamically
 * injected <script>, so this file installs an accessor on `window.agGrid`
 * before that assignment happens and proxies the constructor.
 *
 * Adding real ag-Grid columns (rather than injecting DOM into rows) is what
 * makes the feature survive virtual scrolling, pagination, column resizing
 * and Keepa's own re-renders.
 */

const FINDER_GRID_ID = 'grid-asin-finder';

type ColumnDef = { colId?: string };
type GridApi = {
  setColumnDefs: (defs: unknown[]) => void;
  getColumnDefs?: () => ColumnDef[] | undefined;
  addEventListener?: (event: string, handler: () => void) => void;
};
type GridColumn = { getColId: () => string; isVisible: () => boolean };
type ColumnApi = {
  setColumnsVisible?: (colIds: string[], visible: boolean) => void;
  getAllGridColumns?: () => GridColumn[];
};
type GridOptions = { api?: GridApi; columnApi?: ColumnApi; columnDefs?: ColumnDef[] };
type AgGridNamespace = { Grid?: unknown };

const COMPANION_IDS = new Set<string>(KC_COLUMN_IDS);
const patched = new WeakSet<object>();

function withCompanionColumns(defs: readonly ColumnDef[] | undefined): unknown[] {
  const keepa = (defs ?? []).filter((def) => !COMPANION_IDS.has(def.colId ?? ''));
  return [...keepa, ...companionColumnDefs()];
}

/**
 * Keepa's finder defines ~580 columns and restores the operator's saved
 * column configuration on load, which hides every column that configuration
 * does not name — ours included. Adding the column definitions is therefore
 * only half the job: visibility has to be re-asserted afterwards, and again
 * whenever Keepa reapplies its state.
 */
function forceVisible(columnApi: ColumnApi | undefined): void {
  if (!columnApi?.setColumnsVisible) return;
  const columns = columnApi.getAllGridColumns?.();
  if (!columns) return;

  const hidden = columns
    .filter((column) => COMPANION_IDS.has(column.getColId()) && !column.isVisible())
    .map((column) => column.getColId());

  if (hidden.length > 0) columnApi.setColumnsVisible(hidden, true);
}

function attach(element: unknown, gridOptions: GridOptions | undefined): void {
  if (!(element instanceof HTMLElement) || element.id !== FINDER_GRID_ID) return;

  const api = gridOptions?.api;
  if (!api || patched.has(api)) return;
  patched.add(api);

  // Keepa calls setColumnDefs whenever the user reconfigures columns, which
  // would drop ours. Wrapping the method means every future call re-appends
  // them instead — no event listener, no recursion guard.
  const originalSetColumnDefs = api.setColumnDefs.bind(api);
  api.setColumnDefs = (defs: unknown[]) =>
    originalSetColumnDefs(withCompanionColumns(defs as ColumnDef[]));

  const current = api.getColumnDefs?.() ?? gridOptions?.columnDefs;
  originalSetColumnDefs(withCompanionColumns(current));

  const columnApi = gridOptions?.columnApi;
  let reasserting = false;
  const reassert = (): void => {
    // setColumnsVisible re-fires the event that called us.
    if (reasserting) return;
    reasserting = true;
    try {
      forceVisible(columnApi);
    } finally {
      reasserting = false;
    }
  };

  reassert();
  api.addEventListener?.('columnEverythingChanged', reassert);
  api.addEventListener?.('displayedColumnsChanged', reassert);

  watchProductLinks(element);
  console.info('[Keepa Companion] columns attached to the Product Finder grid');
}

/**
 * Opening a product from the finder counts as a manual search, so the
 * Searched column fills itself without the extra click.
 */
function watchProductLinks(gridElement: HTMLElement): void {
  gridElement.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const asin = asinFromKeepaHref(anchor.getAttribute('href'));
      if (asin) void stampSearched(asin);
    },
    true,
  );
}

function proxyGridConstructor(namespace: AgGridNamespace): AgGridNamespace {
  const Grid = namespace.Grid;
  if (typeof Grid !== 'function' || patched.has(Grid)) return namespace;
  patched.add(Grid);

  // A Proxy rather than a wrapper function: ag-Grid's Grid may be emitted as
  // an ES5 function or an ES2015 class depending on the bundle, and only a
  // construct trap is safe for both.
  namespace.Grid = new Proxy(Grid, {
    construct(target, args, newTarget) {
      const instance = Reflect.construct(target as never, args, newTarget);
      try {
        // ag-Grid assigns gridOptions.api during construction, so the handle
        // exists by the time we get here.
        attach(args[0], args[1] as GridOptions | undefined);
      } catch (error) {
        console.warn('[Keepa Companion] could not attach columns', error);
      }
      return instance;
    },
  });
  return namespace;
}

function install(): void {
  let value: AgGridNamespace | undefined;

  const existing = (window as { agGrid?: AgGridNamespace }).agGrid;
  if (existing) value = proxyGridConstructor(existing);

  Object.defineProperty(window, 'agGrid', {
    configurable: true,
    enumerable: true,
    get: () => value,
    set: (incoming: AgGridNamespace) => {
      value = incoming ? proxyGridConstructor(incoming) : incoming;
    },
  });
}

install();
