"use client";

import { useState, useMemo } from "react";
import FileUpload from "@/components/FileUpload";
import { downloadCSV, downloadPDF } from "@/utils/exportUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Award,
  Search,
  RefreshCw,
  Download,
  FileText,
} from "lucide-react";

interface SalesReportItem {
  itemCode: string;
  itemName: string;
  totalQtySold: number;
  avgQtyPerTransaction: number;
  totalRevenue: number;
  avgRevenuePerTransaction: number;
}

type SortField = keyof SalesReportItem;
type SortOrder = "asc" | "desc";

export default function AverageSalesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SalesReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search & Pagination & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalRevenue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/process-sales", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to process sales report");
      }

      setData(result.data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setData([]);
    setError(null);
    setSearchQuery("");
  };

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const totalRevenue = data.reduce((acc, item) => acc + item.totalRevenue, 0);
    const totalQty = data.reduce((acc, item) => acc + item.totalQtySold, 0);
    const uniqueItems = data.length;

    // Find top item by revenue
    const topItem = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

    return {
      totalRevenue,
      totalQty,
      uniqueItems,
      topItemName: topItem ? topItem.itemName : "N/A",
      topItemRevenue: topItem ? topItem.totalRevenue : 0,
    };
  }, [data]);

  // Top 5 items for Chart
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map((item) => ({
        name: item.itemName.length > 20 ? item.itemName.slice(0, 20) + "..." : item.itemName,
        fullName: item.itemName,
        revenue: item.totalRevenue,
        qty: item.totalQtySold,
      }));
  }, [data]);

  // Filtered & Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.itemCode.toLowerCase().includes(query) ||
          item.itemName.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return result;
  }, [data, searchQuery, sortField, sortOrder]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const csvHeaders = [
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "totalQtySold", label: "Total Qty Sold" },
    { key: "avgQtyPerTransaction", label: "Avg Qty/Transaction" },
    { key: "totalRevenue", label: "Total Revenue" },
    { key: "avgRevenuePerTransaction", label: "Avg Revenue/Transaction" },
  ];

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCSV(processedData, `Average_Sales_Report_${dateStr}.csv`, csvHeaders);
  };

  const handleExportPDF = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    downloadPDF(
      processedData,
      `Average_Sales_Report_${dateStr}.pdf`,
      "Average Sales Report",
      csvHeaders
    );
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"];

  return (
    <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Average Sales Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Visualize and analyze transactional sales metrics aggregated by item.
          </p>
        </div>

        {data.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200 rounded-xl transition"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all duration-200"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* File Upload Block */}
      {data.length === 0 && (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <FileUpload
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
            onClear={handleClear}
            selectedFile={file}
            error={error}
          />
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-400 animate-pulse">
                Analyzing transactions and generating statistics...
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards & Chart View */}
      {data.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* KPI Dashboard Row */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Revenue */}
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Revenue
                  </span>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    ₹{metrics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Units Sold */}
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Quantity
                  </span>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {metrics.totalQty.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
                  <Package className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Unique Items */}
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Unique Products
                  </span>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {metrics.uniqueItems}
                  </div>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Top Contributor */}
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1 max-w-[70%]">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Top Contributor
                  </span>
                  <div className="text-sm font-bold text-white truncate" title={metrics.topItemName}>
                    {metrics.topItemName}
                  </div>
                  <div className="text-xs font-semibold text-pink-400">
                    ₹{metrics.topItemRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Visualization Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top 5 Revenue Chart */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Top 5 Products by Revenue
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                      }}
                      labelClassName="text-slate-400 text-xs font-semibold"
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Insights list */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200 mb-4">
                  Product Performance Insights
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    The top 5 items represent a significant portion of overall revenue. Focus inventories on these high-velocity product lines.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Avg Transaction Revenue:</span>
                      <span className="text-white font-bold">
                        ₹
                        {(
                          data.reduce((acc, item) => acc + item.avgRevenuePerTransaction, 0) /
                          data.length
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Avg Quantity per Txn:</span>
                      <span className="text-white font-bold">
                        {(
                          data.reduce((acc, item) => acc + item.avgQtyPerTransaction, 0) /
                          data.length
                        ).toFixed(1)}{" "}
                        pcs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-800/80">
                <button
                  onClick={handleClear}
                  className="w-full py-2.5 text-sm font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear Data & Upload New
                </button>
              </div>
            </div>
          </div>

          {/* Report Table View */}
          <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl overflow-hidden flex flex-col backdrop-blur-sm">
            {/* Controls Bar */}
            <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/10">
              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by code or name..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              <span className="text-xs font-semibold text-slate-400">
                {processedData.length} records found
              </span>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800/80 text-xs font-bold uppercase tracking-wider">
                    <th
                      onClick={() => handleSort("itemCode")}
                      className="p-4 cursor-pointer hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Item Code {renderSortIndicator("itemCode")}
                    </th>
                    <th
                      onClick={() => handleSort("itemName")}
                      className="p-4 cursor-pointer hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Item Name {renderSortIndicator("itemName")}
                    </th>
                    <th
                      onClick={() => handleSort("totalQtySold")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Total Qty Sold {renderSortIndicator("totalQtySold")}
                    </th>
                    <th
                      onClick={() => handleSort("avgQtyPerTransaction")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Avg Qty/Txn {renderSortIndicator("avgQtyPerTransaction")}
                    </th>
                    <th
                      onClick={() => handleSort("totalRevenue")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Total Revenue {renderSortIndicator("totalRevenue")}
                    </th>
                    <th
                      onClick={() => handleSort("avgRevenuePerTransaction")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Avg Revenue/Txn {renderSortIndicator("avgRevenuePerTransaction")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                  {paginatedData.length > 0 ? (
                    paginatedData.map((item) => (
                      <tr
                        key={item.itemCode}
                        className="hover:bg-slate-800/20 transition-all duration-100"
                      >
                        <td className="p-4 font-mono font-semibold text-indigo-400">
                          {item.itemCode}
                        </td>
                        <td className="p-4 font-medium text-slate-200">
                          {item.itemName}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {item.totalQtySold.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-slate-400">
                          {item.avgQtyPerTransaction}
                        </td>
                        <td className="p-4 text-right font-bold text-indigo-400">
                          ₹{item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right text-slate-400">
                          ₹{item.avgRevenuePerTransaction.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                        No matching records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-900/10 text-xs font-semibold text-slate-400">
                <span>
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, processedData.length)} to{" "}
                  {Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length} records
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-200 transition"
                  >
                    Previous
                  </button>
                  <span className="text-slate-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-200 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
