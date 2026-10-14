#!/usr/bin/env node
const USAGE = `
tex2svg.mjs: typeset one TeX formula to a standalone SVG made only of paths (no fonts needed at render time; colour
is currentColor). One formula per film, set properly and assembled part by part from the picture; never plain-text
math in captions or labels.

  node <SKILL_DIR>/scripts/tex2svg.mjs '<tex>' out.svg

Needs mathjax-full in the project: npm install mathjax-full@3.2.2
Split the SVG into its top-level parts to build it piece by piece; fade parts with fill-opacity, never group opacity.
`
import fs from 'node:fs'
import { parseArgs, usage, fail, importFromProject } from './lib/page.mjs'

const A = parseArgs(process.argv.slice(2))
usage(USAGE, A)
const [tex, out] = A._
if (!tex || !out) fail('usage: tex2svg.mjs "<tex>" out.svg')
const hint = 'Install it in your project: npm install mathjax-full@3.2.2'
const { mathjax } = await importFromProject('mathjax-full/js/mathjax.js', hint)
const { TeX } = await importFromProject('mathjax-full/js/input/tex.js', hint)
const { SVG } = await importFromProject('mathjax-full/js/output/svg.js', hint)
const { liteAdaptor } = await importFromProject('mathjax-full/js/adaptors/liteAdaptor.js', hint)
const { RegisterHTMLHandler } = await importFromProject('mathjax-full/js/handlers/html.js', hint)
const { AllPackages } = await importFromProject('mathjax-full/js/input/tex/AllPackages.js', hint)
const adaptor = liteAdaptor(); RegisterHTMLHandler(adaptor)
const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) })
fs.writeFileSync(out, adaptor.innerHTML(doc.convert(tex, { display: true })))
console.log('wrote', out)
