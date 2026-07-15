import { describe, expect, it } from "vitest";
import {
  createTableClipboardPayload,
  parseTableClipboardPayload,
  serializeTableClipboardPayload,
  tableClipboardPayloadToText,
} from "../../../shared/tableClipboard";

describe("table clipboard payload", () => {
  it("normalizes rectangular cell matrices", () => {
    expect(createTableClipboardPayload([["A", "B"], ["C"]])).toEqual({
      cells: [["A", "B"], ["C", ""]],
      version: 1,
    });
  });

  it("round trips valid payloads and rejects invalid input", () => {
    const payload = createTableClipboardPayload([["A"], ["B"]])!;

    expect(parseTableClipboardPayload(serializeTableClipboardPayload(payload))).toEqual(
      payload,
    );
    expect(parseTableClipboardPayload('{"version":2,"cells":[["A"]]}')).toBeNull();
    expect(parseTableClipboardPayload("not-json")).toBeNull();
  });

  it("projects matrices as tab and newline separated plain text", () => {
    const payload = createTableClipboardPayload([
      ["A", "B\nB2"],
      ["C\tC2", "D"],
    ])!;

    expect(tableClipboardPayloadToText(payload)).toBe("A\tB B2\nC C2\tD");
  });
});
