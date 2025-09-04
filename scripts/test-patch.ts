import assert from 'node:assert';
import { dryRunApply } from '../src/tools/patch.js';

async function main() {
  let threw = false;
  try {
    await dryRunApply('diff --git a/FOO b/FOO\n--- a/FOO\n+++ b/FOO\n@@ -0,0 +1,1 @@\n+bar\n');
  } catch (e: any) {
    threw = true;
    assert.match(e?.message || String(e), /Git repository/i, 'should require a Git repository');
  }
  assert.ok(threw, 'dryRunApply should throw in non-git repo');
  console.log('OK test-patch: non-git repo rejected');
}

main().catch((e)=>{ console.error(e); process.exit(1); });

