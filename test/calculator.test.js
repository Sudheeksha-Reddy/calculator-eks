import { test } from "node:test";
import assert from "node:assert/strict";
import { add, divide } from "../src/calculator.js";

test("add returns the sum", () => {
  assert.equal(add(2, 3), 5);
});

test("divide throws on zero", () => {
  assert.throws(() => divide(4, 0), /divide by zero/);
});
