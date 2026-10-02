import { describe, expect, test } from "vitest";
import { neutralizeFormula, toCsv } from "../src/lib/utils";

describe("CSV export", () => {
  test("neutralizes spreadsheet formulas typed by visitors", () => {
    for (const evil of ['=HYPERLINK("http://evil","x")', "+1+1", "-2+3", "@SUM(A1)", "\t=1"]) {
      expect(neutralizeFormula(evil).startsWith("'")).toBe(true);
    }
    expect(neutralizeFormula("Alice")).toBe("Alice");
    expect(neutralizeFormula("Acme-Corp")).toBe("Acme-Corp");
  });

  test("flattens custom-field answers into columns across all rows", () => {
    const csv = toCsv([
      { name: "A", extraData: { plate: "KDA 1" } },
      { name: "B", extraData: { national_id: "123" } },
    ]);
    const [header, ...rows] = csv.split("\n");
    expect(header).toBe("name,extraData.plate,extraData.national_id");
    expect(rows).toEqual(["A,KDA 1,", "B,,123"]);
  });

  test("quotes commas, quotes and newlines", () => {
    expect(toCsv([{ v: 'He said "hi", ok' }])).toBe('v\n"He said ""hi"", ok"');
  });

  test("a formula inside a quoted cell is still neutralized", () => {
    expect(toCsv([{ v: '=1,2' }])).toBe("v\n\"'=1,2\"");
  });
});
