import { formatTableCell } from "./report-canvas/data/columnTypes";
export default function ReportDataPreview({columns, rows}: {columns: string[]; rows: unknown[][]}) {
  return <div className="report-table-scroll"><table className="report-table">
    <thead><tr>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column, cell) => <td key={cell}>{formatTableCell(row[cell], column)}</td>)}</tr>)}</tbody>
  </table></div>;
}
