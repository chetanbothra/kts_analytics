import { NextRequest, NextResponse } from "next/server";
import { parseFileToMatrix, findColIdx } from "@/utils/csvParser";
import Papa from "papaparse";

export interface BillingWiseItemRow {
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

    const { headers, rows, headerRowIdx } = await parseFileToMatrix(file, [
      "PRODUCT BRANDS",
      "Bill No",
      "Item Code",
      "Item Name",
    ]);

    if (headerRowIdx === -1 || headers.length === 0 || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Uploaded file is empty or contains no valid headers" },
        { status: 400 }
      );
    }

    const idxProductBrands = findColIdx(headers, "PRODUCT BRANDS", "Product Brand");
    const idxDivisions = findColIdx(headers, "Divisions", "Division");
    const idxVertical = findColIdx(headers, "Vertical");
    const idxCustomerName = findColIdx(headers, "Customer Name");
    const idxCustomerType = findColIdx(headers, "Customer Type");
    const idxManufacturerBy = findColIdx(headers, "Manufacturer by", "Manufacturer");
    const idxBillNo = findColIdx(headers, "Bill No");
    const idxBillDate = findColIdx(headers, "Bill Date");
    const idxItemCode = findColIdx(headers, "Item Code");
    const idxItemName = findColIdx(headers, "Item Name");
    const idxMrp = findColIdx(headers, "MRP");
    const idxSelling = findColIdx(headers, "selling", "Selling Rate");
    const idxQtyCld = findColIdx(headers, "Qty in CLD");
    const idxQtyPcs = findColIdx(headers, "Qty in PCs");
    const idxTaxable = findColIdx(headers, "Taxable Amount");
    const idxGstPerc = findColIdx(headers, "GST Perc", "Tax %");
    const idxNetAmt = findColIdx(headers, "Item Net Amount");

    const processedRows: BillingWiseItemRow[] = [];

    for (const rowData of rows) {
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

      processedRows.push({
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

    return NextResponse.json({
      success: true,
      data: processedRows,
      recordCount: processedRows.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
