import { describe, expect, it } from "vitest";
import {
  clampTableSize,
  maxTableSize,
  minTableRows,
} from "../components/TableToolbar";

describe("table toolbar helpers", () => {
  it("clamps table dimensions to the supported picker range", () => {
    expect(clampTableSize({ columns: 0, rows: 0 })).toEqual({
      columns: 1,
      rows: minTableRows,
    });

    expect(
      clampTableSize({ columns: maxTableSize + 10, rows: maxTableSize + 10 }),
    ).toEqual({
      columns: maxTableSize,
      rows: maxTableSize,
    });
  });

  it("rounds fractional dimensions before applying them", () => {
    expect(clampTableSize({ columns: 3.6, rows: 4.2 })).toEqual({
      columns: 4,
      rows: 4,
    });
  });
});

