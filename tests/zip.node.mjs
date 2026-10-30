import { test } from "node:test";
import assert from "node:assert/strict";
import { validZip } from "../lib/zip.mjs";
test("exact 5-digit ZIPs only", () => {
  for (const bad of ["787011", "78701'<script>", "00000", "", "abc", "7870", "78 701", null]) assert.equal(validZip(bad), null, String(bad));
  assert.equal(validZip(" 78701 "), null);
  assert.equal(validZip("78701\n"), null);
  assert.equal(validZip("10001"), "10001");
});
