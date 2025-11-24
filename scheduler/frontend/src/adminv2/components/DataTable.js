import React from 'react';

function HeaderCell({ column }) {
  return (
    <th
      scope="col"
      className={['px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400', column.headerClassName].filter(Boolean).join(' ')}
    >
      {column.header}
    </th>
  );
}

function BodyCell({ column, row }) {
  if (typeof column.render === 'function') {
    return (
      <td className={['px-4 py-3 text-sm text-gray-700 dark:text-gray-200', column.className].filter(Boolean).join(' ')}>
        {column.render(row)}
      </td>
    );
  }
  const value = column.accessor ? column.accessor(row) : row[column.key];
  return (
    <td className={['px-4 py-3 text-sm text-gray-700 dark:text-gray-200', column.className].filter(Boolean).join(' ')}>
      {value}
    </td>
  );
}

export default function DataTable({
  columns,
  rows,
  selection,
  bulkActions,
  loading,
  emptyState,
  onRowClick,
  rowId = (row) => row.id,
}) {
  const hasSelection = Boolean(selection);

  if (loading) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return emptyState || (
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 p-6 text-center">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Nothing to show yet
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Try adjusting filters or date range to see results.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
      {bulkActions && selection?.state.count > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/40 border-b border-blue-100 dark:border-blue-800 px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-200">
            {selection.state.count} selected
          </div>
          <div className="flex items-center gap-2">
            {bulkActions(selection)}
            <button
              type="button"
              onClick={selection.clear}
              className="text-xs font-medium text-blue-600 dark:text-blue-300 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            {hasSelection && (
              <th scope="col" className="px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={selection.state.isAllSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      selection.selectAll();
                    } else {
                      selection.clear();
                    }
                  }}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <HeaderCell key={column.key} column={column} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {rows.map((row) => {
            const id = rowId(row);
            const isSelected = hasSelection ? selection.isSelected(row) : false;
            return (
              <tr
                key={id}
                className={[
                  'hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors',
                  onRowClick ? 'cursor-pointer' : '',
                  isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onRowClick?.(row)}
              >
                {hasSelection && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={isSelected}
                      onChange={(event) => {
                        event.stopPropagation();
                        selection.toggle(row);
                      }}
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <BodyCell key={column.key} column={column} row={row} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

