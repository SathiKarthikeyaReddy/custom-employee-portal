import React from 'react';

export const DataTable = ({ columns, data, loading = false, emptyMessage = 'No records found' }) => {
  return (
    <div className="w-full border border-border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-100/75 border-b border-border text-stone-600 text-[11px] font-heading font-bold uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th key={col.key || idx} className={`px-4 py-3 ${col.className || ''}`}>
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs text-ink-text">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-stone-500">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-stone-400 border-t-forest rounded-full animate-spin"></div>
                    <span className="font-heading uppercase tracking-widest text-[11px]">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-stone-500">
                  <p className="font-heading uppercase tracking-wider text-xs">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="hover:bg-stone-50/75 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={col.key || colIdx} className={`px-4 py-3 align-middle ${col.cellClassName || ''}`}>
                      {col.render ? col.render(row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
