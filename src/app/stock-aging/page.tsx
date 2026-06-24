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
  AlertTriangle,
  Clock,
  CheckCircle,
  Package,
  Search,
  RefreshCw,
  Download,
  FileText,
  PieChart as PieIcon,
} from "lucide-react";

interface StockAgingItem {
  itemCode: string;
  itemName: string;
  totalStock: number;
  daysFromMfg: number;
  daysToExpire: number;
  status: "URGENT" | "SOON" | "SAFE" | string;
}

type SortField = keyof StockAgingItem;
type SortOrder = "asc" | "desc";

export default function StockAgingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StockAgingItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search & Pagination & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("daysToExpire");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const itemsPerPage = 50;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsLoading(true);
    setStatusFilter(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/process-closing", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to process stock aging report");
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
    setStatusFilter(null);
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

    const totalStock = data.reduce((acc, item) => acc + item.totalStock, 0);
    const urgentItems = data.filter((item) => item.status === "URGENT").length;
    const soonItems = data.filter((item) => item.status === "SOON").length;
    const safeItems = data.filter((item) => item.status === "SAFE").length;

    // Find soonest expiry item
    const criticalItem = [...data].sort((a, b) => a.daysToExpire - b.daysToExpire)[0];

    return {
      totalStock,
      urgentItems,
      soonItems,
      safeItems,
      criticalItemName: criticalItem ? criticalItem.itemName : "N/A",
      criticalItemDays: criticalItem ? criticalItem.daysToExpire : 0,
    };
  }, [data]);

  // Chart Data for Status Distribution
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const urgentCount = data.filter((item) => item.status === "URGENT").length;
    const soonCount = data.filter((item) => item.status === "SOON").length;
    const safeCount = data.filter((item) => item.status === "SAFE").length;

    return [
      { name: "Urgent (<30d)", value: urgentCount, color: "#f43f5e" },
      { name: "Soon (<60d)", value: soonCount, color: "#f59e0b" },
      { name: "Safe (60d+)", value: safeCount, color: "#10b981" },
    ];
  }, [data]);

  // Filtered & Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Status filter
    if (statusFilter) {
      result = result.filter((item) => item.status === statusFilter);
    }

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
  }, [data, searchQuery, sortField, sortOrder, statusFilter]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const csvHeaders = [
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "totalStock", label: "Total Stock" },
    { key: "daysFromMfg", label: "Days From Mfg" },
    { key: "daysToExpire", label: "Days To Expire" },
    { key: "status", label: "Status" },
  ];

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCSV(processedData, `Stock_Aging_Report_${dateStr}.csv`, csvHeaders);
  };

  const handleExportPDF = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    downloadPDF(
      processedData,
      `Stock_Aging_Report_${dateStr}.pdf`,
      "Stock Aging Report",
      csvHeaders
    );
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            URGENT
          </span>
        );
      case "SOON":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            SOON
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            SAFE
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent">
            Stock Aging Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Identify expiring products, monitor risk distributions, and manage fresh stocks.
          </p>
        </div>

        {data.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200 rounded-xl transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all duration-200"
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
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
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
                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-400 animate-pulse">
                Evaluating stock expiry profiles...
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
              {/* Card 1: Total Stock */}
              <div
                onClick={() => setStatusFilter(null)}
                className={`cursor-pointer bg-slate-900/30 border rounded-2xl p-5 flex items-center justify-between transition duration-300 backdrop-blur-sm relative overflow-hidden ${
                  statusFilter === null
                    ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-800/20"
                }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Closing Stock
                  </span>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {metrics.totalStock.toLocaleString()}
                  </div>
                  {statusFilter === null && (
                    <span className="text-[10px] text-emerald-400 font-bold block">Active Filter: ALL</span>
                  )}
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Package className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Urgent Items */}
              <div
                onClick={() => setStatusFilter(statusFilter === "URGENT" ? null : "URGENT")}
                className={`cursor-pointer bg-slate-900/30 border rounded-2xl p-5 flex items-center justify-between transition duration-300 backdrop-blur-sm relative overflow-hidden ${
                  statusFilter === "URGENT"
                    ? "border-rose-500 bg-rose-500/5 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                    : "border-slate-800/80 hover:border-rose-500/20 hover:bg-slate-800/20"
                }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Urgent (Expiry &lt; 30d)
                  </span>
                  <div className="text-2xl font-bold text-rose-400 tracking-tight">
                    {metrics.urgentItems}
                  </div>
                  {statusFilter === "URGENT" && (
                    <span className="text-[10px] text-rose-400 font-bold block">Active Filter: URGENT</span>
                  )}
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Card 3: Soon Items */}
              <div
                onClick={() => setStatusFilter(statusFilter === "SOON" ? null : "SOON")}
                className={`cursor-pointer bg-slate-900/30 border rounded-2xl p-5 flex items-center justify-between transition duration-300 backdrop-blur-sm relative overflow-hidden ${
                  statusFilter === "SOON"
                    ? "border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    : "border-slate-800/80 hover:border-amber-500/20 hover:bg-slate-800/20"
                }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Attention (Expiry &lt; 60d)
                  </span>
                  <div className="text-2xl font-bold text-amber-400 tracking-tight">
                    {metrics.soonItems}
                  </div>
                  {statusFilter === "SOON" && (
                    <span className="text-[10px] text-amber-400 font-bold block">Active Filter: SOON</span>
                  )}
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Safe Items */}
              <div
                onClick={() => setStatusFilter(statusFilter === "SAFE" ? null : "SAFE")}
                className={`cursor-pointer bg-slate-900/30 border rounded-2xl p-5 flex items-center justify-between transition duration-300 backdrop-blur-sm relative overflow-hidden ${
                  statusFilter === "SAFE"
                    ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "border-slate-800/80 hover:border-emerald-500/20 hover:bg-slate-800/20"
                }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Safe Stock (60d+)
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                    {metrics.safeItems}
                  </div>
                  {statusFilter === "SAFE" && (
                    <span className="text-[10px] text-emerald-400 font-bold block">Active Filter: SAFE</span>
                  )}
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Visualization Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Breakdown Chart */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-emerald-400" />
                Expiry Risk Profile Distribution
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                      }}
                      labelClassName="text-slate-400 text-xs font-semibold"
                      formatter={(value: any) => [value, "Items Count"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
                  Stock Control Center
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Prioritize promotions or return-to-vendor flows for products flagged as <span className="text-rose-400 font-bold">URGENT</span> to minimize wastage losses.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Critical Risk Items (&lt;30d):</span>
                      <span className="text-rose-400 font-bold">{metrics?.urgentItems}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Moderate Risk Items (&lt;60d):</span>
                      <span className="text-amber-400 font-bold">{metrics?.soonItems}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Safe Stock Items (60d+):</span>
                      <span className="text-emerald-400 font-bold">{metrics?.safeItems}</span>
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
                      onClick={() => handleSort("totalStock")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Total Stock {renderSortIndicator("totalStock")}
                    </th>
                    <th
                      onClick={() => handleSort("daysFromMfg")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Days From Mfg {renderSortIndicator("daysFromMfg")}
                    </th>
                    <th
                      onClick={() => handleSort("daysToExpire")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Days To Expire {renderSortIndicator("daysToExpire")}
                    </th>
                    <th
                      onClick={() => handleSort("status")}
                      className="p-4 cursor-pointer text-center hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Status {renderSortIndicator("status")}
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
                          {item.totalStock.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-slate-400">
                          {item.daysFromMfg} days
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {item.daysToExpire} days
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(item.status)}
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
