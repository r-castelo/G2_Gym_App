import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDatasetInt,
  parseLoadInput,
  parseRepInput,
  readEventValue,
} from "../src/phone/utils";

describe("readEventValue", () => {
  it("reads target value", () => {
    const e = { target: { value: "target" } } as unknown as Event;
    assert.equal(readEventValue(e), "target");
  });

  it("joins array values", () => {
    const e = { target: { value: ["a", "b"] } } as unknown as Event;
    assert.equal(readEventValue(e), "a,b");
  });

  it("returns empty string when value is missing", () => {
    const e = {} as Event;
    assert.equal(readEventValue(e), "");
  });
});

describe("parseRepInput", () => {
  it("parses AMRAP", () => {
    assert.deepEqual(parseRepInput("AMRAP"), { type: "toFailure" });
  });

  it("parses ranges", () => {
    assert.deepEqual(parseRepInput("8-12"), { type: "range", min: 8, max: 12 });
  });
});

describe("parseLoadInput", () => {
  it("parses bodyweight", () => {
    assert.deepEqual(parseLoadInput("BW"), { type: "bodyweight" });
  });

  it("parses weights", () => {
    assert.deepEqual(parseLoadInput("85kg"), { type: "weight", value: 85, unit: "kg" });
  });
});

describe("getDatasetInt", () => {
  it("parses integer dataset values", () => {
    assert.equal(getDatasetInt("42"), 42);
  });

  it("returns NaN-backed default for invalid values", () => {
    assert.equal(getDatasetInt(undefined), 0);
  });
});
