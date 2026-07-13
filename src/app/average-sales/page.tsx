"use client";

import { useState, useMemo, useEffect } from "react";
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
  district: string;
  conversionFactor: number;
  totalQtyCld: number;
  totalQtySold: number;
  avgQtyPerTransaction: number;
  totalRevenue: number;
  avgRevenuePerTransaction: number;
  status: string;
}

type SortField = keyof SalesReportItem;
type SortOrder = "asc" | "desc";

const SAMPLE_SALES_DATA: SalesReportItem[] = [
  {
    itemCode: "180026205",
    itemName: "KESH K. ANTI DANDRUF HAIR CLEANSER 180ML",
    district: "Chennai",
    conversionFactor: 36,
    totalQtyCld: 3,
    totalQtySold: 108,
    avgQtyPerTransaction: 36,
    totalRevenue: 10259.58,
    avgRevenuePerTransaction: 3419.86,
    status: "Active Sales",
  },
  {
    itemCode: "150001114",
    itemName: "ATTA NOODLES CHATPATA FAMILY PACK 240 GM",
    district: "Chennai",
    conversionFactor: 24,
    totalQtyCld: 2,
    totalQtySold: 48,
    avgQtyPerTransaction: 24,
    totalRevenue: 1696.96,
    avgRevenuePerTransaction: 848.48,
    status: "Active Sales",
  },
];

export default function AverageSalesPage() {
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SalesReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStats, setProcessingStats] = useState<{
    itemCount: number;
    timeTaken: number;
    errors: number;
  } | null>(null);

  // Filter State: "all" | "active" | "missing"
  const [salesFilter, setSalesFilter] = useState<"all" | "active" | "missing">("all");

  // Search & Pagination & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalRevenue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const itemsPerPage = 50;

  useEffect(() => {
    const handleReload = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "Sales") {
        const stored = sessionStorage.getItem("kts_active_sales_report");
        if (stored) {
          const report = JSON.parse(stored);
          setData(report.data);
          setSalesFile(new File([], report.filename));
          setProcessingStats({
            itemCount: report.recordCount,
            timeTaken: 0.1,
            errors: 0,
          });
        }
      }
    };

    window.addEventListener("kts-report-loaded", handleReload);

    // Initial check
    const stored = sessionStorage.getItem("kts_active_sales_report");
    if (stored) {
      const report = JSON.parse(stored);
      setData(report.data);
      setSalesFile(new File([], report.filename));
      setProcessingStats({
        itemCount: report.recordCount,
        timeTaken: 0.1,
        errors: 0,
      });
    }

    return () => {
      window.removeEventListener("kts-report-loaded", handleReload);
    };
  }, []);

  const saveRecentReport = (filename: string, recordCount: number, reportData: SalesReportItem[]) => {
    const newReport = {
      id: Math.random().toString(36).substring(2, 9),
      type: "Sales",
      filename,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recordCount,
      data: reportData,
    };
    const current = localStorage.getItem("kts_recent_reports");
    let list = current ? JSON.parse(current) : [];
    // remove duplicates of same type/filename if any, to keep it clean
    list = list.filter((r: any) => !(r.type === "Sales" && r.filename === filename));
    list = [newReport, ...list].slice(0, 3);
    localStorage.setItem("kts_recent_reports", JSON.stringify(list));
    window.dispatchEvent(new Event("kts-recent-reports-updated"));
  };

  const handleProcess = async () => {
    if (!salesFile) {
      setError("Please upload a Sales CSV file first.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setProcessingStats(null);
    setDistrictFilter(null);
    const startTime = performance.now();

    const formData = new FormData();
    formData.append("file", salesFile);
    if (masterFile) {
      formData.append("masterFile", masterFile);
    }

    try {
      const response = await fetch("/api/process-sales", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to process sales report");
      }

      const duration = parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
      setData(result.data);
      setProcessingStats({
        itemCount: result.recordCount,
        timeTaken: duration,
        errors: 0,
      });
      saveRecentReport(salesFile.name, result.recordCount, result.data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSample = () => {
    setError(null);
    setIsLoading(true);
    setProcessingStats(null);
    setDistrictFilter(null);
    setTimeout(() => {
      setData(SAMPLE_SALES_DATA);
      setSalesFile(new File([], "SALES_SAMPLE.csv"));
      setMasterFile(null);
      setProcessingStats({
        itemCount: SAMPLE_SALES_DATA.length,
        timeTaken: 0.1,
        errors: 0,
      });
      saveRecentReport("SALES_SAMPLE.csv", SAMPLE_SALES_DATA.length, SAMPLE_SALES_DATA);
      setIsLoading(false);
      setCurrentPage(1);
    }, 500);
  };

  const handleClear = () => {
    setSalesFile(null);
    setMasterFile(null);
    setData([]);
    setError(null);
    setSearchQuery("");
    setDistrictFilter(null);
    setProcessingStats(null);
    setSalesFilter("all");
    sessionStorage.removeItem("kts_active_sales_report");
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

  // Unique Districts for Filtering
  const uniqueDistricts = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.district).filter(Boolean))).sort();
  }, [data]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const totalRevenue = data.reduce((acc, item) => acc + item.totalRevenue, 0);
    const totalQty = data.reduce((acc, item) => acc + item.totalQtySold, 0);
    const uniqueItems = new Set(data.filter(d => d.status !== "No Sales").map(d => d.itemCode)).size;
    const missingCount = data.filter(d => d.status === "No Sales").length;

    // Find top item by revenue
    const topItem = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

    return {
      totalRevenue,
      totalQty,
      uniqueItems,
      missingCount,
      topItemName: topItem ? topItem.itemName : "N/A",
      topItemRevenue: topItem ? topItem.totalRevenue : 0,
    };
  }, [data]);

  // Filtered & Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // District filter
    if (districtFilter) {
      result = result.filter((item) => item.district === districtFilter);
    }

    // Sales filter (all, active, missing)
    if (salesFilter === "active") {
      result = result.filter((item) => item.status === "Active Sales");
    } else if (salesFilter === "missing") {
      result = result.filter((item) => item.status === "No Sales");
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
  }, [data, searchQuery, sortField, sortOrder, districtFilter, salesFilter]);

  // Subtotals for all processed records (ignoring pagination, but matching search/district query)
  const subtotals = useMemo(() => {
    const totalQtyCld = processedData.reduce((acc, item) => acc + item.totalQtyCld, 0);
    const totalQty = processedData.reduce((acc, item) => acc + item.totalQtySold, 0);
    const totalRev = processedData.reduce((acc, item) => acc + item.totalRevenue, 0);
    return { totalQtyCld, totalQty, totalRev };
  }, [processedData]);

  // Top 5 items for Chart
  const chartData = useMemo(() => {
    return [...processedData]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map((item) => ({
        name: item.itemName.length > 20 ? item.itemName.slice(0, 20) + "..." : item.itemName,
        fullName: item.itemName,
        revenue: item.totalRevenue,
        qty: item.totalQtySold,
      }));
  }, [processedData]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const csvHeaders = [
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "district", label: "Depot/District" },
    { key: "conversionFactor", label: "Conversion Factor" },
    { key: "totalQtyCld", label: "Total Qty Sold (CLD)" },
    { key: "totalQtySold", label: "Total Qty Sold (PCs)" },
    { key: "avgQtyPerTransaction", label: "Avg Qty/Transaction" },
    { key: "totalRevenue", label: "Total Revenue" },
    { key: "avgRevenuePerTransaction", label: "Avg Revenue/Transaction" },
    { key: "status", label: "Status" },
  ];

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const uniqueDistricts = Array.from(new Set(processedData.map((d) => d.district).filter(Boolean)));
    
    if (uniqueDistricts.length <= 1) {
      const districtSuffix = uniqueDistricts.length === 1 ? `-${uniqueDistricts[0]}` : "";
      downloadCSV(processedData, `Average_Sales_Report_${dateStr}${districtSuffix}.csv`, csvHeaders);
    } else {
      uniqueDistricts.forEach((district) => {
        const districtData = processedData.filter((d) => d.district === district);
        downloadCSV(districtData, `Average_Sales_Report_${dateStr}-${district}.csv`, csvHeaders);
      });
    }
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
            Visualize and analyze transactional sales metrics aggregated by item and depot.
          </p>
        </div>

        {data.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200 rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* File Upload Block */}
      {data.length === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales CSV Upload */}
            <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                1. Sales Data CSV (Required)
              </h3>
              <FileUpload
                onFileSelect={(f) => { setSalesFile(f); setError(null); }}
                isLoading={isLoading}
                onClear={() => setSalesFile(null)}
                selectedFile={salesFile}
                error={null}
                hint="Drop Sales CSV here"
                onUseSample={handleUseSample}
              />
            </div>

            {/* Master CSV Upload */}
            <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                2. Master / Closing Stock CSV (Optional - to find missing models)
              </h3>
              <FileUpload
                onFileSelect={(f) => { setMasterFile(f); setError(null); }}
                isLoading={isLoading}
                onClear={() => setMasterFile(null)}
                selectedFile={masterFile}
                error={null}
                hint="Drop CLOSING.csv here"
              />
            </div>
          </div>

          {/* Action Button */}
          {salesFile && !isLoading && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={handleProcess}
                className="px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm tracking-wide"
              >
                Process Sales Analytics
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-slate-900/20 border border-slate-800/80 rounded-3xl">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-400 animate-pulse">
                Analyzing transactions and mapping against master stock...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400 font-medium">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing Status Badge */}
      {data.length > 0 && processingStats && (
        <div className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-in fade-in duration-300">
          ✓ {processingStats.itemCount} items processed in {processingStats.timeTaken}s | Errors: {processingStats.errors}
        </div>
      )}

      {/* KPI Cards & Chart View */}
      {data.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* KPI Dashboard Row */}
          {metrics && (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${metrics.missingCount > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-5`}>
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
                    Total Quantity (PCs)
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

              {/* Card 5: Missing Models */}
              {metrics.missingCount > 0 && (
                <div className="bg-slate-900/30 border border-rose-950/80 rounded-2xl p-5 flex items-center justify-between hover:border-rose-900/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
                      Missing Models
                    </span>
                    <div className="text-2xl font-bold text-rose-450 tracking-tight text-rose-400">
                      {metrics.missingCount}
                    </div>
                  </div>
                  <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                    <Layers className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
              )}
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
                      itemStyle={{ color: "#e2e8f0", fontSize: "12px" }}
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
                          processedData.reduce((acc, item) => acc + item.avgRevenuePerTransaction, 0) /
                          Math.max(1, processedData.length)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Avg Quantity per Txn:</span>
                      <span className="text-white font-bold">
                        {(
                          processedData.reduce((acc, item) => acc + item.avgQtyPerTransaction, 0) /
                          Math.max(1, processedData.length)
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
                  className="w-full py-2.5 text-sm font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear Data & Upload New
                </button>
              </div>
            </div>
          </div>

          {/* Report Table View */}
          <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl overflow-hidden flex flex-col backdrop-blur-sm max-h-[600px]">
            {/* Controls Bar */}
            <div className="p-5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/10">
              <div className="flex flex-wrap items-center gap-3 max-w-2xl w-full">
                <div className="relative min-w-[200px] flex-1">
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

                {/* Depot/District Filter Dropdown */}
                {uniqueDistricts.length > 0 && (
                  <select
                    value={districtFilter || ""}
                    onChange={(e) => {
                      setDistrictFilter(e.target.value || null);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Depots</option>
                    {uniqueDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                )}

                {/* Filter Tabs */}
                {metrics && metrics.missingCount > 0 && (
                  <div className="flex items-center bg-slate-900 p-1 border border-slate-800 rounded-xl">
                    <button
                      onClick={() => { setSalesFilter("all"); setCurrentPage(1); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${salesFilter === "all" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:text-white"}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => { setSalesFilter("active"); setCurrentPage(1); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${salesFilter === "active" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:text-white"}`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => { setSalesFilter("missing"); setCurrentPage(1); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${salesFilter === "missing" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "text-slate-400 hover:text-white"}`}
                    >
                      Missing ({metrics.missingCount})
                    </button>
                  </div>
                )}
              </div>

              <span className="text-xs font-semibold text-slate-400">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, processedData.length)}-{Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length} items
              </span>
            </div>

            {/* Table Container */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 z-10 bg-slate-950">
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
                      onClick={() => handleSort("district")}
                      className="p-4 cursor-pointer hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Depot/District {renderSortIndicator("district")}
                    </th>
                    <th
                      onClick={() => handleSort("conversionFactor")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Conversion Factor {renderSortIndicator("conversionFactor")}
                    </th>
                    <th
                      onClick={() => handleSort("totalQtyCld")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Total Qty Sold (CLD) {renderSortIndicator("totalQtyCld")}
                    </th>
                    <th
                      onClick={() => handleSort("totalQtySold")}
                      className="p-4 cursor-pointer text-right hover:bg-slate-800/40 hover:text-white transition"
                    >
                      Total Qty Sold (PCs) {renderSortIndicator("totalQtySold")}
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
                    <th className="p-4 text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                  {paginatedData.length > 0 ? (
                    paginatedData.map((item) => (
                      <tr
                        key={`${item.itemCode}-${item.district}`}
                        className={`hover:bg-slate-800/20 transition-all duration-100 ${item.status === "No Sales" ? "bg-rose-950/5 opacity-60 hover:opacity-100" : ""}`}
                      >
                        <td className="p-4 font-mono font-semibold text-indigo-400">
                          {item.itemCode}
                        </td>
                        <td className="p-4 font-medium text-slate-200">
                          {item.itemName}
                        </td>
                        <td className="p-4 text-slate-400">
                          {item.district}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-400">
                          {item.conversionFactor}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-400">
                          {item.totalQtyCld.toLocaleString()}
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
                        <td className="p-4 text-center">
                          {item.status === "No Sales" ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              No Sales
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-450 text-emerald-450 text-emerald-450 border border-emerald-500/20 text-emerald-400">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                        No matching records found.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Sticky Subtotals Row */}
                {processedData.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-slate-900 border-t border-slate-800 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]">
                    <tr className="text-slate-200 font-bold text-sm">
                      <td className="p-4" colSpan={4}>Subtotal</td>
                      <td className="p-4 text-right font-mono text-slate-400">{subtotals.totalQtyCld.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right">{subtotals.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-slate-400">—</td>
                      <td className="p-4 text-right text-indigo-400">₹{subtotals.totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-slate-400">—</td>
                      <td className="p-4 text-center text-slate-400">—</td>
                    </tr>
                  </tfoot>
                )}
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
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-200 transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-200 transition cursor-pointer"
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
