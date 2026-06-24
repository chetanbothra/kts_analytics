import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

interface ClosingCsvRow {
  "Item Code"?: string;
  "Item Name"?: string;
  "AVAILABLE STOCK"?: string;
  "Days From Manufacture"?: string;
  "Days To Expire"?: string;
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

    const parsed = Papa.parse<ClosingCsvRow>(fileContent, {
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
    const requiredColumns = [
      "Item Code",
      "Item Name",
      "AVAILABLE STOCK",
      "Days From Manufacture",
      "Days To Expire",
    ];
    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          { success: false, error: `CSV missing required column: ${col}` },
          { status: 400 }
        );
      }
    }

    // Grouping by Item Code
    const aggregated: Record<string, {
      itemCode: string;
      itemName: string;
      totalStock: number;
      daysFromMfg: number;
      daysToExpire: number;
    }> = {};

    for (const row of parsed.data) {
      const rawCode = row["Item Code"];
      const rawName = row["Item Name"];
      const rawStock = row["AVAILABLE STOCK"];
      const rawMfg = row["Days From Manufacture"];
      const rawExpire = row["Days To Expire"];

      if (!rawCode || !rawName) continue;

      const itemCode = rawCode.trim();
      const itemName = rawName.trim();
      if (!itemCode) continue;

      const stock = parseFloat(rawStock || "0");
      const mfg = parseFloat(rawMfg || "0");
      const expire = parseFloat(rawExpire || "0");

      if (isNaN(stock) || isNaN(mfg) || isNaN(expire)) continue;

      if (!aggregated[itemCode]) {
        aggregated[itemCode] = {
          itemCode,
          itemName,
          totalStock: 0,
          daysFromMfg: -Infinity,
          daysToExpire: Infinity,
        };
      }

      const current = aggregated[itemCode];
      current.totalStock += stock;
      current.daysFromMfg = Math.max(current.daysFromMfg, mfg);
      current.daysToExpire = Math.min(current.daysToExpire, expire);
    }

    // Format output, status and sort by Days To Expire (ascending)
    const result = Object.values(aggregated).map((item) => {
      // Handle fallback values if no valid data was found
      const daysFromMfg = item.daysFromMfg === -Infinity ? 0 : item.daysFromMfg;
      const daysToExpire = item.daysToExpire === Infinity ? 9999 : item.daysToExpire;

      let status = "SAFE";
      if (daysToExpire < 30) {
        status = "URGENT";
      } else if (daysToExpire < 60) {
        status = "SOON";
      }

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        totalStock: item.totalStock,
        daysFromMfg,
        daysToExpire,
        status,
      };
    });

    // Sort by Days To Expire (ascending - soonest expiry first)
    result.sort((a, b) => a.daysToExpire - b.daysToExpire);

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
