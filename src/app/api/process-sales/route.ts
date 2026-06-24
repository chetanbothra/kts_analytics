import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

interface SalesCsvRow {
  "Item Code"?: string;
  "Item Name"?: string;
  "Bill Date"?: string;
  "Qty in PCs"?: string;
  "Item Net Amount"?: string;
  [key: string]: string | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Please select a CSV file" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { success: false, error: "Only CSV files allowed" },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    if (!fileContent.trim()) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty" },
        { status: 400 }
      );
    }

    const parsed = Papa.parse<SalesCsvRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { success: false, error: `Error parsing CSV: ${parsed.errors[0].message}` },
        { status: 400 }
      );
    }

    const headers = parsed.meta.fields || [];
    const requiredColumns = ["Item Code", "Item Name", "Qty in PCs", "Item Net Amount"];
    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          { success: false, error: `CSV missing required column: ${col}` },
          { status: 400 }
        );
      }
    }

    // Grouping and aggregating by Item Code
    const aggregated: Record<string, {
      itemCode: string;
      itemName: string;
      totalQtySold: number;
      transactionCount: number;
      totalRevenue: number;
    }> = {};

    for (const row of parsed.data) {
      const rawCode = row["Item Code"];
      const rawName = row["Item Name"];
      const rawQty = row["Qty in PCs"];
      const rawRevenue = row["Item Net Amount"];

      if (!rawCode || !rawName) continue;

      const itemCode = rawCode.trim();
      const itemName = rawName.trim();
      if (!itemCode) continue;

      const qty = parseFloat(rawQty || "0");
      const revenue = parseFloat(rawRevenue || "0");

      if (isNaN(qty) || isNaN(revenue)) continue;

      if (!aggregated[itemCode]) {
        aggregated[itemCode] = {
          itemCode,
          itemName,
          totalQtySold: 0,
          transactionCount: 0,
          totalRevenue: 0,
        };
      }

      aggregated[itemCode].totalQtySold += qty;
      aggregated[itemCode].totalRevenue += revenue;
      aggregated[itemCode].transactionCount += 1;
    }

    // Format output and calculate averages
    const result = Object.values(aggregated).map((item) => {
      const avgQtyPerTransaction = item.transactionCount > 0
        ? parseFloat((item.totalQtySold / item.transactionCount).toFixed(2))
        : 0;
      const avgRevenuePerTransaction = item.transactionCount > 0
        ? parseFloat((item.totalRevenue / item.transactionCount).toFixed(2))
        : 0;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        totalQtySold: item.totalQtySold,
        avgQtyPerTransaction,
        totalRevenue: parseFloat(item.totalRevenue.toFixed(2)),
        avgRevenuePerTransaction,
      };
    });

    // Sort by Item Code
    result.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    return NextResponse.json({
      success: true,
      data: result,
      recordCount: result.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
