import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadCSV(
  data: any[],
  filename: string,
  headers: { key: string; label: string }[]
) {
  const csvContent = [
    headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h.key];
          const escaped = String(val === null || val === undefined ? "" : val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadPDF(
  data: any[],
  filename: string,
  title: string,
  headers: { key: string; label: string }[]
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

  const tableHeaders = headers.map((h) => h.label);
  const tableData = data.map((row) => headers.map((h) => row[h.key]));

  autoTable(doc, {
    startY: 26,
    head: [tableHeaders],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
    styles: { fontSize: 8 },
  });

  doc.save(filename);
}
