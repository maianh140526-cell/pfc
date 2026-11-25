import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, checkPdf } from "./service";

const pdf = (body = "1 0 obj << /Type /Catalog >> endobj") => Buffer.from(`%PDF-1.7\n${body}\ntrailer\n%%EOF\n`, "latin1");

describe("PDF upload check", () => {
  it("accepts a plain PDF", () => {
    expect(checkPdf(pdf())).toBeNull();
  });
  it("rejects non-PDF, oversized, truncated and active-content files", () => {
    expect(checkPdf(Buffer.from("<html><script>alert(1)</script>"))).toMatch(/Chỉ nhận tệp PDF/);
    expect(checkPdf(Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x25))).toMatch(/4 MB/);
    expect(checkPdf(Buffer.from("%PDF-1.7\n1 0 obj"))).toMatch(/hỏng/);
    expect(checkPdf(pdf("<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>"))).toMatch(/mã chạy tự động/);
    expect(checkPdf(pdf("<< /Type /EmbeddedFile >>"))).toMatch(/đính kèm/);
    expect(checkPdf(Buffer.alloc(0))).toMatch(/rỗng/);
  });
});
