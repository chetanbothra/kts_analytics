import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

interface SalesCsvRow {
  "Item Code"?: string;
  "Item Name"?: string;
  "Bill Date"?: string;
  "Qty in CLD"?: string;
  "Qty in PCs"?: string;
  "Item Net Amount"?: string;
  "Conversion Factor"?: string;
  "district"?: string;
  "District"?: string;
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
    const requiredColumns = ["Item Code", "Item Name", "Item Net Amount"];
    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          { success: false, error: `CSV missing required column: ${col}` },
          { status: 400 }
        );
      }
    }

    // Grouping and aggregating by Item Code and District/Depot
    const aggregated: Record<string, {
      itemCode: string;
      itemName: string;
      district: string;
      totalQtySold: number;
      totalQtyCld: number;
      conversionFactor: number;
      transactionCount: number;
      totalRevenue: number;
    }> = {};

    const activeDistricts = new Set<string>();

    for (const row of parsed.data) {
      const rawCode = row["Item Code"];
      const rawName = row["Item Name"];
      const rawQtyCld = row["Qty in CLD"];
      const rawQtyPcs = row["Qty in PCs"];
      const rawRevenue = row["Item Net Amount"];
      const rawConversionFactor = row["Conversion Factor"];
      const rawDistrict = row["district"] || row["District"] || "N/A";

      if (!rawCode || !rawName) continue;

      const itemCode = rawCode.trim();
      const itemName = rawName.trim();
      const district = rawDistrict.trim();
      if (!itemCode) continue;

      activeDistricts.add(district);

      const conversionFactor = parseFloat(rawConversionFactor || "1");
      const validCF = isNaN(conversionFactor) || conversionFactor <= 0 ? 1 : conversionFactor;

      let qty = 0;
      let qtyCld = 0;

      // "yellow-highlighted quantity in the CLD sheet should be considered while calculating the sales average"
      if (rawQtyCld && parseFloat(rawQtyCld) !== 0) {
        qtyCld = parseFloat(rawQtyCld);
        if (!isNaN(qtyCld)) {
          qty = qtyCld * validCF;
        } else {
          qtyCld = 0;
          qty = parseFloat(rawQtyPcs || "0");
        }
      } else {
        qty = parseFloat(rawQtyPcs || "0");
      }

      const revenue = parseFloat(rawRevenue || "0");

      if (isNaN(qty) || isNaN(revenue)) continue;

      const key = `${itemCode}_${district}`;

      if (!aggregated[key]) {
        aggregated[key] = {
          itemCode,
          itemName,
          district,
          totalQtySold: 0,
          totalQtyCld: 0,
          conversionFactor: validCF,
          transactionCount: 0,
          totalRevenue: 0,
        };
      }

      aggregated[key].totalQtySold += qty;
      aggregated[key].totalQtyCld += qtyCld;
      aggregated[key].totalRevenue += revenue;
      aggregated[key].transactionCount += 1;
    }

    // Process optional master file to find missing models
    const masterFile = formData.get("masterFile") as File | null;
    if (masterFile && masterFile.size > 0) {
      const masterContent = await masterFile.text();
      const parsedMaster = Papa.parse<any>(masterContent, {
        header: true,
        skipEmptyLines: true,
      });

      const masterHeaders = parsedMaster.meta.fields || [];
      if (masterHeaders.includes("Item Code")) {
        for (const row of parsedMaster.data) {
          const rawCode = row["Item Code"];
          const rawName = row["Item Name"];
          const rawCF = row["Conversion Factor"];
          // Use district from row, fallback to first active district or 'Chennai'
          const rawDistrict = row["district"] || row["District"] || (activeDistricts.size > 0 ? Array.from(activeDistricts)[0] : "Chennai");

          if (!rawCode) continue;

          const itemCode = rawCode.trim();
          const itemName = (rawName || "").trim();
          const district = rawDistrict.trim();

          // We only align with districts that actually exist in active sales report
          if (activeDistricts.size > 0 && !activeDistricts.has(district)) {
            continue;
          }

          const key = `${itemCode}_${district}`;
          if (!aggregated[key]) {
            const conversionFactor = parseFloat(rawCF || "1");
            const validCF = isNaN(conversionFactor) || conversionFactor <= 0 ? 1 : conversionFactor;
            
            aggregated[key] = {
              itemCode,
              itemName: itemName || `Product ${itemCode}`,
              district,
              totalQtySold: 0,
              totalQtyCld: 0,
              conversionFactor: validCF,
              transactionCount: 0,
              totalRevenue: 0,
            };
          }
        }
      }
    }

    // Format output and calculate averages
    const result = Object.values(aggregated).map((item) => {
      const avgQtyPerTransaction = item.transactionCount > 0
        ? parseFloat((item.totalQtySold / item.transactionCount).toFixed(2))
        : 0;
      const avgRevenuePerTransaction = item.transactionCount > 0
        ? parseFloat((item.totalRevenue / item.transactionCount).toFixed(2))
        : 0;

      const hasSales = item.transactionCount > 0;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        district: item.district,
        conversionFactor: item.conversionFactor,
        totalQtyCld: parseFloat(item.totalQtyCld.toFixed(2)),
        totalQtySold: parseFloat(item.totalQtySold.toFixed(2)),
        avgQtyPerTransaction,
        totalRevenue: parseFloat(item.totalRevenue.toFixed(2)),
        avgRevenuePerTransaction,
        status: hasSales ? "Active Sales" : "No Sales",
      };
    });

    // Sort by District, then Item Code
    result.sort((a, b) => {
      const distComp = a.district.localeCompare(b.district);
      if (distComp !== 0) return distComp;
      return a.itemCode.localeCompare(b.itemCode);
    });

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
