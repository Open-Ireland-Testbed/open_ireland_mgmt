import { useCallback, useMemo, useState } from 'react';

export default function useBulkSelection(rows, rowIdSelector = (row) => row.id) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggle = useCallback(
    (row) => {
      const id = rowIdSelector(row);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [rowIdSelector]
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    const next = new Set();
    rows.forEach((row) => next.add(rowIdSelector(row)));
    setSelectedIds(next);
  }, [rows, rowIdSelector]);

  const isSelected = useCallback(
    (row) => selectedIds.has(rowIdSelector(row)),
    [selectedIds, rowIdSelector]
  );

  const selectedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return rows.filter((row) => selectedIds.has(rowIdSelector(row)));
  }, [rows, rowIdSelector, selectedIds]);

  const state = useMemo(
    () => ({
      ids: selectedIds,
      count: selectedIds.size,
      isAllSelected: rows.length > 0 && selectedIds.size === rows.length,
    }),
    [rows.length, selectedIds]
  );

  return {
    state,
    selectedRows,
    toggle,
    clear,
    selectAll,
    isSelected,
  };
}

