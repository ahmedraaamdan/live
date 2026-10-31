import { build } from 'esbuild';
import assert from 'node:assert/strict';
const { outputFiles } = await build({ entryPoints: ['../live-app/src/lib/calendar.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const calendar = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
let checks = 0;
for (const [input, expected] of [['2026-01-15T19:00','2026-01-15T17:00:00.000Z'],['2026-07-15T19:00','2026-07-15T16:00:00.000Z']]) { assert.equal(calendar.fromCairoInput(input).toISOString(), expected); assert.equal(calendar.toCairoInput(new Date(expected)), input); checks += 2; }
assert.equal(calendar.fromCairoInput('2026-02-30T19:00'), null); checks++;
assert.equal(calendar.fromCairoInput('2026-01-15T25:00'), null); checks++;
assert.equal(calendar.cairoWeekStart('2026-10-30'), '2026-10-24'); checks++;
assert.equal(calendar.addCalendarDays('2026-12-31', 1), '2027-01-01'); checks++;
process.env.TZ = 'Pacific/Honolulu'; assert.equal(calendar.toCairoInput(new Date('2026-01-15T17:00:00Z')), '2026-01-15T19:00'); checks++;
assert.equal(calendar.toCairoInput(calendar.cairoSlot('2026-10-31',24)), '2026-11-01T00:00');checks++;
assert.equal(calendar.toCairoInput(calendar.cairoSlot('2026-12-31',24)), '2027-01-01T00:00');checks++;
assert.equal(calendar.toCairoInput(calendar.cairoSlot('2026-11-01',-1)), '2026-10-31T23:00');checks++;
assert.ok(Number.isFinite(calendar.cairoSlot('2026-04-24',0).getTime()));checks++;
console.log(`${checks} Cairo calendar timezone and date checks passed`);
