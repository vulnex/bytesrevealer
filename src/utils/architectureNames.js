/**
 * VULNEX -Bytes Revealer-
 *
 * File: architectureNames.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-17
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Human-readable architecture name lookups for PE / ELF / Mach-O. Shared
 * between the Embedded Executables UI panel and the extraction service
 * (which uses them for suggested filenames).
 */

export const PE_MACHINE_NAMES = {
  0x014c: 'i386',
  0x0200: 'IA64',
  0x8664: 'x86-64',
  0x01c0: 'ARM',
  0x01c4: 'ARMv7',
  0xaa64: 'ARM64',
  0x01f0: 'PowerPC',
  0x01f1: 'PowerPC FP',
  0x0166: 'MIPS16',
  0x0266: 'MIPS FPU',
  0x0162: 'MIPS R3000',
  0x0168: 'MIPS R10000',
  0x0184: 'ALPHA',
  0x0284: 'ALPHA64',
  0x0ebc: 'EFI',
  0x5032: 'RISC-V 32',
  0x5064: 'RISC-V 64'
}

export const ELF_MACHINE_NAMES = {
  0x02: 'SPARC',
  0x03: 'x86',
  0x08: 'MIPS',
  0x14: 'PowerPC',
  0x15: 'PowerPC64',
  0x16: 'S390',
  0x28: 'ARM',
  0x2a: 'SuperH',
  0x32: 'IA-64',
  0x3e: 'x86-64',
  0x53: 'AVR',
  0xb7: 'AArch64',
  0xf3: 'RISC-V',
  0xf7: 'BPF'
}

export const MACHO_CPU_NAMES = {
  0x00000001: 'VAX',
  0x00000006: 'MC680x0',
  0x00000007: 'x86',
  0x01000007: 'x86-64',
  0x0000000c: 'ARM',
  0x0100000c: 'ARM64',
  0x0200000c: 'ARM64_32',
  0x00000012: 'PowerPC',
  0x01000012: 'PowerPC64'
}

/**
 * Convert any architecture name into a filesystem-safe token suitable
 * for use in suggested filenames. Replaces non-alphanumerics with `-`.
 */
export function sanitizeArchToken(name) {
  if (!name) return 'unknown'
  return name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
