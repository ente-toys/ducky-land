import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {optimizeSvg, optimizeSvgDirectory, losslessSvgBuild} from '../scripts/optimize-svg.mjs';

test('SVG cleanup preserves pixels, numeric precision and adjacent decimal boundaries', async () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="clip"><path d="M0.00 0.00H64.000V64.00H0.00Z"/></clipPath></defs><g clip-path="url(#clip)" fill="#c65" stroke="#123"><path d="M1.00.50 L50.123456789 2.000 C60.00 10.500 30.000 45.000 2.000 50.000Z"/><path d='M20.00 20.00q10.00 -2.500 10.000 15.000t-10.000 15.000'/></g></svg>`;
  const optimized = optimizeSvg(source);
  assert.ok(optimized.includes('M1 .5'));
  assert.ok(optimized.includes('50.123456789'));
  assert.ok(optimized.length < source.length);
  assert.equal(optimizeSvg(optimized), optimized);
  const render = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  assert.deepEqual(await render(optimized), await render(source));
});

test('SVG cleanup leaves arcs, exponents, IDs, comments, CDATA and non-path attributes intact', () => {
  const source = `<svg><path id="part1.00" data-d="M1.00 2.00" d="M1e2 2.00"/><path d="M1.00 2.00A5.00 5.00 0 0110.00 20.00"/><text>1.00</text><!-- <path d="M1.00 2.00"/> --><![CDATA[<path d="M1.00 2.00"/>]]></svg>`;
  assert.equal(optimizeSvg(source), source);
});

test('production hook optimizes nested emitted SVGs without changing source files or other output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ducky-svg-'));
  try {
    await mkdir(join(directory, 'dist/nested'), {recursive: true});
    await mkdir(join(directory, 'public/nested'), {recursive: true});
    await mkdir(join(directory, 'dist/assets'), {recursive: true});
    const source = '<svg><path d="M1.00 2.000L3.50 4.000Z"/></svg>';
    await writeFile(join(directory, 'public/nested/art.svg'), source);
    await writeFile(join(directory, 'dist/nested/art.svg'), source);
    await writeFile(join(directory, 'dist/art.json'), source);
    await writeFile(join(directory, 'dist/assets/hashed.svg'), source);
    const plugin = losslessSvgBuild();
    plugin.configResolved({root: directory, publicDir: join(directory, 'public'), build: {outDir: 'dist'}});
    await plugin.closeBundle();
    assert.equal(await readFile(join(directory, 'dist/nested/art.svg'), 'utf8'), optimizeSvg(source));
    assert.equal(await readFile(join(directory, 'public/nested/art.svg'), 'utf8'), source);
    assert.equal(await readFile(join(directory, 'dist/art.json'), 'utf8'), source);
    assert.equal(await readFile(join(directory, 'dist/assets/hashed.svg'), 'utf8'), source);
    assert.equal((await optimizeSvgDirectory(join(directory, 'dist'), join(directory, 'public'))).files, 0);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
