"use client";

import { useState, useMemo, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import { downloadCSV } from "@/utils/exportUtils";
import { parseFileToMatrix, findColIdx as searchColIdx } from "@/utils/csvParser";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  DollarSign,
  Package,
  Search,
  Download,
  Receipt,
  Percent,
} from "lucide-react";

export interface BillingWiseRow {
  productBrands: string;
  divisions: string;
  vertical: string;
  customerName: string;
  customerType: string;
  manufacturerBy: string;
  billNo: string;
  billDate: string;
  itemCode: string;
  itemName: string;
  mrp: number;
  selling: number;
  qtyInCld: number;
  qtyInPcs: number;
  taxableAmount: number;
  gstPerc: number;
  itemNetAmount: number;
  sdMargin: string;
  sdMarginValue: number;
}

type SortField = keyof BillingWiseRow;
type SortOrder = "asc" | "desc";

export default function BillingWiseSalesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<BillingWiseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStats, setProcessingStats] = useState<{
    itemCount: number;
    timeTaken: number;
    errors: number;
  } | null>(null);

  // Search, Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("billNo");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const stored = sessionStorage.getItem("kts_active_billing_report");
    if (stored) {
      try {
        const report = JSON.parse(stored);
        setData(report.data);
        setFile(new File([], report.filename));
        setProcessingStats({
          itemCount: report.recordCount,
          timeTaken: 0.1,
          errors: 0,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveRecentReport = (filename: string, recordCount: number, reportData: BillingWiseRow[]) => {
    const sessionObj = { filename, recordCount, data: reportData };
    sessionStorage.setItem("kts_active_billing_report", JSON.stringify(sessionObj));

    const newReport = {
      id: Math.random().toString(36).substring(2, 9),
      type: "BillingWise",
      filename,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recordCount,
      data: reportData,
    };
    const current = localStorage.getItem("kts_recent_reports");
    let list = current ? JSON.parse(current) : [];
    list = list.filter((r: any) => !(r.type === "BillingWise" && r.filename === filename));
    list = [newReport, ...list].slice(0, 3);
    localStorage.setItem("kts_recent_reports", JSON.stringify(list));
    window.dispatchEvent(new Event("kts-recent-reports-updated"));
  };

  const handleProcess = async () => {
    if (!file) {
      setError("Please select a Billing Wise Item Sales file.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setProcessingStats(null);
    const startTime = performance.now();

    try {
      const { headers, rows: matrixRows, headerRowIdx } = await parseFileToMatrix(file, [
        "PRODUCT BRANDS",
        "Bill No",
        "Item Code",
        "Item Name",
        "Customer Name",
        "Taxable Amount",
      ]);

      if (headerRowIdx === -1 || headers.length === 0) {
        throw new Error("Uploaded sheet is empty or contains unreadable content.");
      }

      // Helper to find column index by candidate header names
      const findColIdx = (...candidates: string[]) => searchColIdx(headers, ...candidates);

      // Mappings based on Serial Numbers
      const idxProductBrands = findColIdx("PRODUCT BRANDS", "Product Brand");
      const idxDivisions = findColIdx("Divisions", "Division");
      const idxVertical = findColIdx("Vertical");
      const idxCustomerName = findColIdx("Customer Name");
      const idxCustomerType = findColIdx("Customer Type");
      const idxManufacturerBy = findColIdx("Manufacturer by", "Manufacturer");
      const idxBillNo = findColIdx("Bill No");
      const idxBillDate = findColIdx("Bill Date");
      const idxItemCode = findColIdx("Item Code");
      const idxItemName = findColIdx("Item Name");
      const idxMrp = findColIdx("MRP");
      const idxSelling = findColIdx("selling", "Selling Rate");
      const idxQtyCld = findColIdx("Qty in CLD");
      const idxQtyPcs = findColIdx("Qty in PCs");
      const idxTaxable = findColIdx("Taxable Amount");
      const idxGstPerc = findColIdx("GST Perc", "Tax %");
      const idxNetAmt = findColIdx("Item Net Amount");

      const rows: BillingWiseRow[] = [];

      for (let i = 0; i < matrixRows.length; i++) {
        const rowData = matrixRows[i];
        if (!rowData || rowData.length === 0) continue;

        const getVal = (colIdx: number) => {
          if (colIdx === -1 || rowData[colIdx] === undefined || rowData[colIdx] === null) return "";
          return String(rowData[colIdx]).trim();
        };

        const parseFloatVal = (colIdx: number) => {
          const str = getVal(colIdx).replace(/,/g, "");
          if (!str) return 0;
          const parsed = parseFloat(str);
          return isNaN(parsed) ? 0 : parsed;
        };

        const billNo = getVal(idxBillNo);
        const itemCode = getVal(idxItemCode);
        const itemName = getVal(idxItemName);

        if (!billNo && !itemCode && !itemName) continue;

        const productBrands = getVal(idxProductBrands);
        const divisions = getVal(idxDivisions);
        const vertical = getVal(idxVertical);
        const customerName = getVal(idxCustomerName);
        const customerType = getVal(idxCustomerType);
        const manufacturerBy = getVal(idxManufacturerBy);
        const billDate = getVal(idxBillDate);
        const mrp = parseFloatVal(idxMrp);
        const selling = parseFloatVal(idxSelling);
        const qtyInCld = parseFloatVal(idxQtyCld);
        const qtyInPcs = parseFloatVal(idxQtyPcs);
        const taxableAmount = parseFloatVal(idxTaxable);
        const gstPerc = parseFloatVal(idxGstPerc);
        const itemNetAmount = parseFloatVal(idxNetAmt);

        const sdMargin = "2%";
        const sdMarginValue = parseFloat((taxableAmount * 0.02).toFixed(4));

        rows.push({
          productBrands,
          divisions,
          vertical,
          customerName,
          customerType,
          manufacturerBy,
          billNo,
          billDate,
          itemCode,
          itemName,
          mrp,
          selling,
          qtyInCld,
          qtyInPcs,
          taxableAmount,
          gstPerc,
          itemNetAmount,
          sdMargin,
          sdMarginValue,
        });
      }

      if (rows.length === 0) {
        throw new Error("No valid data rows found in the uploaded file. Please check column headers.");
      }

      const duration = parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
      setData(rows);
      setProcessingStats({
        itemCount: rows.length,
        timeTaken: duration,
        errors: 0,
      });
      saveRecentReport(file.name, rows.length, rows);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during processing");
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
    setDivisionFilter("all");
    setCustomerTypeFilter("all");
    setProcessingStats(null);
    sessionStorage.removeItem("kts_active_billing_report");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const uniqueDivisions = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.divisions).filter(Boolean))).sort();
  }, [data]);

  const uniqueCustomerTypes = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.customerType).filter(Boolean))).sort();
  }, [data]);

  const metrics = useMemo(() => {
    if (data.length === 0) return null;
    const totalTaxable = data.reduce((acc, row) => acc + row.taxableAmount, 0);
    const totalNetAmount = data.reduce((acc, row) => acc + row.itemNetAmount, 0);
    const totalSdMarginValue = data.reduce((acc, row) => acc + row.sdMarginValue, 0);
    const uniqueBills = new Set(data.map((d) => d.billNo).filter(Boolean)).size;
    const uniqueCustomers = new Set(data.map((d) => d.customerName).filter(Boolean)).size;

    return {
      totalTaxable,
      totalNetAmount,
      totalSdMarginValue,
      uniqueBills,
      uniqueCustomers,
    };
  }, [data]);

  const processedData = useMemo(() => {
    let result = [...data];

    if (divisionFilter !== "all") {
      result = result.filter((d) => d.divisions === divisionFilter);
    }

    if (customerTypeFilter !== "all") {
      result = result.filter((d) => d.customerType === customerTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.billNo.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          d.itemName.toLowerCase().includes(q) ||
          d.itemCode.toLowerCase().includes(q) ||
          d.productBrands.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      } else {
        return sortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return result;
  }, [data, divisionFilter, customerTypeFilter, searchQuery, sortField, sortOrder]);

  const subtotals = useMemo(() => {
    const totalQtyCld = processedData.reduce((acc, r) => acc + r.qtyInCld, 0);
    const totalQtyPcs = processedData.reduce((acc, r) => acc + r.qtyInPcs, 0);
    const totalTaxable = processedData.reduce((acc, r) => acc + r.taxableAmount, 0);
    const totalNet = processedData.reduce((acc, r) => acc + r.itemNetAmount, 0);
    const totalSdVal = processedData.reduce((acc, r) => acc + r.sdMarginValue, 0);

    return { totalQtyCld, totalQtyPcs, totalTaxable, totalNet, totalSdVal };
  }, [processedData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const csvHeaders = [
    { key: "productBrands", label: "PRODUCT BRANDS" },
    { key: "divisions", label: "Divisions" },
    { key: "vertical", label: "Vertical" },
    { key: "customerName", label: "Customer Name" },
    { key: "customerType", label: "Customer Type" },
    { key: "manufacturerBy", label: "Manufacturer by" },
    { key: "billNo", label: "Bill No" },
    { key: "billDate", label: "Bill Date" },
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "mrp", label: "MRP" },
    { key: "selling", label: "selling" },
    { key: "qtyInCld", label: "Qty in CLD" },
    { key: "qtyInPcs", label: "Qty in PCs" },
    { key: "taxableAmount", label: "Taxable Amount" },
    { key: "gstPerc", label: "GST Perc" },
    { key: "itemNetAmount", label: "Item Net Amount" },
    { key: "sdMargin", label: "SD MARGIN" },
    { key: "sdMarginValue", label: "SD MARGIN VALUE" },
  ];

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCSV(processedData, `Billing_Wise_Item_Sales_Margin_2%_${dateStr}.csv`, csvHeaders);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent">
            Billing Wise Item Sales
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Process bill-wise item detail reports and calculate 2% SD Margin values with aligned columns.
          </p>
        </div>

        {data.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleClear}
              className="px-4 py-2.5 text-sm font-semibold bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-300 rounded-xl transition cursor-pointer"
            >
              Upload Another File
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg hover:shadow-emerald-500/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Formatted CSV
            </button>
          </div>
        )}
      </div>

      {/* File Upload Block */}
      {data.length === 0 && (
        <div className="space-y-6">
          <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group max-w-2xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider text-center">
              Upload Billing Wise Sales CSV / Excel Dump
            </h3>
            <FileUpload
              onFileSelect={(f) => {
                setFile(f);
                setError(null);
              }}
              isLoading={isLoading}
              onClear={() => setFile(null)}
              selectedFile={file}
              error={null}
              hint="Drop BillWiseItemSalesDetail file here"
            />
          </div>

          {file && !isLoading && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={handleProcess}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm tracking-wide"
              >
                Generate 2% Margin Report
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-slate-900/20 border border-slate-800/80 rounded-3xl max-w-2xl mx-auto">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-400 animate-pulse">
                Aligning yellow columns, removing red columns & calculating 2% Taxable SD Margin...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400 font-medium whitespace-pre-wrap max-w-2xl mx-auto">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing Status Badge */}
      {data.length > 0 && processingStats && (
        <div className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-in fade-in duration-300">
          ✓ {processingStats.itemCount} billing records parsed in {processingStats.timeTaken}s
        </div>
      )}

      {/* KPI Cards */}
      {data.length > 0 && metrics && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Invoices */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Bills
                </span>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {metrics.uniqueBills.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Across {metrics.uniqueCustomers} Customers
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Taxable Amount */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Taxable Amount
                </span>
                <div className="text-2xl font-bold text-white tracking-tight">
                  ₹{metrics.totalTaxable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Item Net Amount */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Item Net Amount
                </span>
                <div className="text-2xl font-bold text-white tracking-tight">
                  ₹{metrics.totalNetAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Package className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: SD Margin 2% Value */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition duration-300 backdrop-blur-sm relative overflow-hidden border-l-4 border-l-emerald-500">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  SD Margin (2% Value)
                </span>
                <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                  ₹{metrics.totalSdMarginValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-emerald-500/80 block font-medium">
                  2% of Taxable Amount
                </span>
              </div>
              <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400">
                <Percent className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Table Control Toolbar */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search Bill No, Customer, Item..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {uniqueDivisions.length > 0 && (
                <select
                  value={divisionFilter}
                  onChange={(e) => {
                    setDivisionFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="all">All Divisions</option>
                  {uniqueDivisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
              )}

              {uniqueCustomerTypes.length > 0 && (
                <select
                  value={customerTypeFilter}
                  onChange={(e) => {
                    setCustomerTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="all">All Customer Types</option>
                  {uniqueCustomerTypes.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Formatted Data Table */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/90 text-slate-400 font-semibold sticky top-0 z-10 backdrop-blur-md">
                  <tr className="border-b border-slate-800">
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("productBrands")}>
                      PRODUCT BRANDS{renderSortIndicator("productBrands")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("divisions")}>
                      Divisions{renderSortIndicator("divisions")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("vertical")}>
                      Vertical{renderSortIndicator("vertical")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("customerName")}>
                      Customer Name{renderSortIndicator("customerName")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("customerType")}>
                      Customer Type{renderSortIndicator("customerType")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("manufacturerBy")}>
                      Manufacturer by{renderSortIndicator("manufacturerBy")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("billNo")}>
                      Bill No{renderSortIndicator("billNo")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("billDate")}>
                      Bill Date{renderSortIndicator("billDate")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("itemCode")}>
                      Item Code{renderSortIndicator("itemCode")}
                    </th>
                    <th className="p-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort("itemName")}>
                      Item Name{renderSortIndicator("itemName")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("mrp")}>
                      MRP{renderSortIndicator("mrp")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("selling")}>
                      selling{renderSortIndicator("selling")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("qtyInCld")}>
                      Qty in CLD{renderSortIndicator("qtyInCld")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("qtyInPcs")}>
                      Qty in PCs{renderSortIndicator("qtyInPcs")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer bg-amber-500/10 text-amber-300" onClick={() => handleSort("taxableAmount")}>
                      Taxable Amount (2% Base){renderSortIndicator("taxableAmount")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("gstPerc")}>
                      GST Perc{renderSortIndicator("gstPerc")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort("itemNetAmount")}>
                      Item Net Amount{renderSortIndicator("itemNetAmount")}
                    </th>
                    <th className="p-3 whitespace-nowrap text-center bg-emerald-500/10 text-emerald-300">
                      SD MARGIN
                    </th>
                    <th className="p-3 whitespace-nowrap text-right cursor-pointer bg-emerald-500/10 text-emerald-300" onClick={() => handleSort("sdMarginValue")}>
                      SD MARGIN VALUE{renderSortIndicator("sdMarginValue")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {paginatedData.map((row, idx) => (
                    <tr
                      key={`${row.billNo}_${row.itemCode}_${idx}`}
                      className="hover:bg-slate-800/40 transition duration-150"
                    >
                      <td className="p-3 whitespace-nowrap">{row.productBrands}</td>
                      <td className="p-3 whitespace-nowrap">{row.divisions}</td>
                      <td className="p-3 whitespace-nowrap">{row.vertical}</td>
                      <td className="p-3 whitespace-nowrap font-medium text-slate-200">{row.customerName}</td>
                      <td className="p-3 whitespace-nowrap">{row.customerType}</td>
                      <td className="p-3 whitespace-nowrap text-slate-400">{row.manufacturerBy}</td>
                      <td className="p-3 whitespace-nowrap font-mono text-indigo-400">{row.billNo}</td>
                      <td className="p-3 whitespace-nowrap text-slate-400">{row.billDate}</td>
                      <td className="p-3 whitespace-nowrap font-mono">{row.itemCode}</td>
                      <td className="p-3 whitespace-nowrap max-w-[200px] truncate text-slate-200" title={row.itemName}>
                        {row.itemName}
                      </td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">₹{row.mrp.toFixed(2)}</td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">₹{row.selling.toFixed(2)}</td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">{row.qtyInCld}</td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">{row.qtyInPcs}</td>
                      <td className="p-3 whitespace-nowrap text-right font-mono bg-amber-500/5 font-semibold text-amber-300">
                        ₹{row.taxableAmount.toFixed(2)}
                      </td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">{row.gstPerc}%</td>
                      <td className="p-3 whitespace-nowrap text-right font-mono">₹{row.itemNetAmount.toFixed(2)}</td>
                      <td className="p-3 whitespace-nowrap text-center bg-emerald-500/5 font-bold text-emerald-400">
                        {row.sdMargin}
                      </td>
                      <td className="p-3 whitespace-nowrap text-right font-mono bg-emerald-500/5 font-bold text-emerald-300">
                        ₹{row.sdMarginValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Subtotals Row */}
                  <tr className="bg-slate-950/80 font-bold border-t-2 border-slate-700 text-slate-200">
                    <td colSpan={12} className="p-3 text-right uppercase tracking-wider text-xs">
                      Subtotals ({processedData.length} Records):
                    </td>
                    <td className="p-3 text-right font-mono">{subtotals.totalQtyCld.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">{subtotals.totalQtyPcs.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-amber-300">₹{subtotals.totalTaxable.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">-</td>
                    <td className="p-3 text-right font-mono">₹{subtotals.totalNet.toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-400 font-bold">2%</td>
                    <td className="p-3 text-right font-mono text-emerald-300">₹{subtotals.totalSdVal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40 text-xs">
                <span className="text-slate-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition"
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
