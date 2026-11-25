import { describe, expect, it } from "vitest";
import { cleanFileName, detectOfficeOrText } from "./attachment";

const zip = (names: string[]) => Buffer.from(`PK\x03\x04${names.join("\0")}`, "latin1");

describe("attachment sniffing", () => {
  it("recognises docx / xlsx / pptx by their package folders", () => {
    expect(detectOfficeOrText(zip(["[Content_Types].xml", "word/document.xml"]), "a.docx")).toMatchObject({ kind: { ext: "docx" } });
    expect(detectOfficeOrText(zip(["[Content_Types].xml", "xl/workbook.xml"]), "a.xlsx")).toMatchObject({ kind: { ext: "xlsx" } });
    expect(detectOfficeOrText(zip(["[Content_Types].xml", "ppt/presentation.xml"]), "a.pptx")).toMatchObject({ kind: { ext: "pptx" } });
  });
  it("refuses macros, plain zips, binaries and empty files", () => {
    expect(detectOfficeOrText(zip(["[Content_Types].xml", "word/vbaProject.bin"]), "a.docx")).toHaveProperty("error");
    expect(detectOfficeOrText(zip(["hello.txt"]), "a.zip")).toHaveProperty("error");
    expect(detectOfficeOrText(Buffer.from([1, 2, 0, 3]), "a.exe")).toHaveProperty("error");
    expect(detectOfficeOrText(Buffer.alloc(0), "a.txt")).toHaveProperty("error");
  });
  it("accepts UTF-8 text and picks csv by name", () => {
    expect(detectOfficeOrText(Buffer.from("xin chào"), "ghi-chu.txt")).toMatchObject({ kind: { ext: "txt" } });
    expect(detectOfficeOrText(Buffer.from("a,b\n1,2"), "x.CSV")).toMatchObject({ kind: { ext: "csv" } });
    expect(detectOfficeOrText(Buffer.from([0xff, 0xfe, 0x41]), "x.txt")).toHaveProperty("error");
  });
  it("cleans names", () => {
    expect(cleanFileName("C:\\x\\bai<tap>.pdf")).toBe("baitap.pdf");
    expect(cleanFileName("")).toBe("tai-lieu");
  });
});
