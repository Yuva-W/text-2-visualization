function TableView({ table }) {
    const columns = table.columns || [];
    const rows = table.rows || [];

    if (!columns.length) {
        return (
            <p className="p-6 text-sm text-mist">
                This table does not contain any columns.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead className="bg-ink-700">
                    <tr>
                        {columns.map((column, index) => (
                            <th
                                key={`${column}-${index}`}
                                className="whitespace-nowrap px-4 py-3 font-semibold text-chalk"
                            >
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className="border-t border-line odd:bg-ink-800/60 even:bg-ink-900"
                        >
                            {columns.map((_, columnIndex) => (
                                <td
                                    key={columnIndex}
                                    className="px-4 py-3 text-mist"
                                >
                                    {row[columnIndex] ?? ""}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {rows.length === 0 && (
                <p className="p-4 text-sm text-mist">
                    This table does not contain any rows.
                </p>
            )}
        </div>
    );
}

export default TableView;
