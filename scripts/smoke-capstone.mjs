import { Capstone, Const, loadCapstone } from 'capstone-wasm'

// x86-64 function prologue + epilogue
// 55                 push rbp
// 48 89 e5           mov  rbp, rsp
// 48 83 ec 10        sub  rsp, 0x10
// c9                 leave
// c3                 ret
const bytes = new Uint8Array([0x55, 0x48, 0x89, 0xe5, 0x48, 0x83, 0xec, 0x10, 0xc9, 0xc3])

console.log('Loading capstone WASM...')
const t0 = performance.now()
await loadCapstone()
console.log(`  loaded in ${(performance.now() - t0).toFixed(1)} ms`)

console.log(`Capstone version: ${JSON.stringify(Capstone.version())}`)

const cs = new Capstone(Const.CS_ARCH_X86, Const.CS_MODE_64)
const instructions = cs.disasm(bytes, { address: 0x1000 })
cs.close()

console.log(`\nDisassembled ${instructions.length} instructions:`)
for (const ins of instructions) {
  const hex = Array.from(ins.bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  console.log(`  0x${ins.address.toString(16).padStart(8, '0')}: ${hex.padEnd(15)}  ${ins.mnemonic} ${ins.opStr}`)
}

const expected = ['push', 'mov', 'sub', 'leave', 'ret']
const got = instructions.map((i) => i.mnemonic)
const pass = expected.every((m, i) => got[i] === m)
console.log(`\n${pass ? '✓ PASS' : '✗ FAIL'}: mnemonic sequence ${pass ? 'matches' : 'does not match'} expected`)
process.exit(pass ? 0 : 1)
