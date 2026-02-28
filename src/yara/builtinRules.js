/**
 * VULNEX -Bytes Revealer-
 *
 * File: builtinRules.js
 * Author: Simon Roses Femerling
 * Created: 2026-02-10
 * Last Modified: 2026-02-10
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Built-in YARA rule sets for common binary analysis patterns.
 * Note: libyara-wasm does not support PE/ELF/magic modules —
 * these rules use pure pattern matching only.
 */

export const BUILTIN_RULE_SETS = [
  {
    id: 'malware_common',
    name: 'Common Malware Patterns',
    description: 'Suspicious PE imports, shellcode patterns, and base64-encoded executables',
    rules: `rule Suspicious_PE_Imports
{
    meta:
        description = "Detects suspicious Windows API import names commonly used by malware"
        author = "BytesRevealer"

    strings:
        $api1 = "VirtualAlloc" ascii
        $api2 = "VirtualProtect" ascii
        $api3 = "WriteProcessMemory" ascii
        $api4 = "CreateRemoteThread" ascii
        $api5 = "NtUnmapViewOfSection" ascii
        $api6 = "IsDebuggerPresent" ascii
        $api7 = "GetProcAddress" ascii
        $api8 = "LoadLibraryA" ascii
        $api9 = "OpenProcess" ascii
        $api10 = "WinExec" ascii

    condition:
        3 of them
}

rule Shellcode_Patterns
{
    meta:
        description = "Common x86/x64 shellcode byte sequences"
        author = "BytesRevealer"

    strings:
        $nop_sled = { 90 90 90 90 90 90 90 90 }
        $call_pop = { E8 00 00 00 00 (58 | 59 | 5A | 5B | 5D | 5E | 5F) }
        $fs_30 = { 64 A1 30 00 00 00 }
        $gs_60 = { 65 48 8B 04 25 60 00 00 00 }
        $int_2e = { CD 2E }
        $syscall = { 0F 05 }

    condition:
        any of them
}

rule Base64_Executable
{
    meta:
        description = "Detects base64-encoded PE executables embedded in files"
        author = "BytesRevealer"

    strings:
        $mz_b64_1 = "TVqQAAMAA" ascii
        $mz_b64_2 = "TVpQAAIAA" ascii
        $mz_b64_3 = "TVoAAAAA" ascii

    condition:
        any of them
}

rule Suspicious_Strings_Combo
{
    meta:
        description = "Combination of suspicious strings often found in malicious binaries"
        author = "BytesRevealer"

    strings:
        $s1 = "cmd.exe" ascii nocase
        $s2 = "powershell" ascii nocase
        $s3 = "/c " ascii
        $s4 = "bypass" ascii nocase
        $s5 = "-enc " ascii nocase
        $s6 = "downloadstring" ascii nocase
        $s7 = "Invoke-Expression" ascii nocase

    condition:
        3 of them
}`
  },
  {
    id: 'crypto_indicators',
    name: 'Crypto Indicators',
    description:
      'Cryptocurrency mining strings, wallet address patterns, and crypto library references',
    rules: `rule Crypto_Mining_Strings
{
    meta:
        description = "Strings associated with cryptocurrency mining software"
        author = "BytesRevealer"

    strings:
        $s1 = "stratum+tcp://" ascii
        $s2 = "stratum+ssl://" ascii
        $s3 = "xmrig" ascii nocase
        $s4 = "cpuminer" ascii nocase
        $s5 = "hashrate" ascii nocase
        $s6 = "mining_pool" ascii nocase
        $s7 = "cryptonight" ascii nocase
        $s8 = "randomx" ascii nocase
        $s9 = "ethash" ascii nocase

    condition:
        2 of them
}

rule Wallet_Address_Patterns
{
    meta:
        description = "Patterns matching cryptocurrency wallet address prefixes and references"
        author = "BytesRevealer"

    strings:
        $btc_prefix1 = "bitcoin:" ascii nocase
        $btc_prefix2 = "bc1q" ascii
        $btc_prefix3 = "BTC" ascii
        $eth_prefix = "0x" ascii
        $xmr_prefix = "monero:" ascii nocase
        $wallet = "wallet" ascii nocase
        $address = "address" ascii nocase

    condition:
        2 of them
}

rule Crypto_Library_References
{
    meta:
        description = "References to cryptographic algorithms and libraries"
        author = "BytesRevealer"

    strings:
        $aes = "AES-256" ascii nocase
        $rsa = "RSA" ascii
        $sha256 = "SHA256" ascii
        $chacha = "ChaCha20" ascii nocase
        $salsa = "Salsa20" ascii nocase
        $rc4 = "RC4" ascii
        $blowfish = "Blowfish" ascii nocase

    condition:
        2 of them
}`
  },
  {
    id: 'packers',
    name: 'Packers & Protectors',
    description: 'UPX, ASPack, Themida, VMProtect, and other packer/protector signatures',
    rules: `rule UPX_Packed
{
    meta:
        description = "Detects UPX packed executables"
        author = "BytesRevealer"

    strings:
        $upx0 = "UPX0" ascii
        $upx1 = "UPX1" ascii
        $upx2 = "UPX!" ascii
        $upx_sig = { 55 50 58 21 }

    condition:
        2 of them
}

rule ASPack_Packed
{
    meta:
        description = "Detects ASPack packed executables"
        author = "BytesRevealer"

    strings:
        $aspack1 = ".aspack" ascii
        $aspack2 = ".adata" ascii
        $aspack3 = "ASPack" ascii

    condition:
        any of them
}

rule Themida_Protected
{
    meta:
        description = "Detects Themida/WinLicense protected executables"
        author = "BytesRevealer"

    strings:
        $t1 = ".themida" ascii
        $t2 = "Themida" ascii
        $t3 = "WinLicense" ascii
        $t4 = ".Oreans" ascii

    condition:
        any of them
}

rule VMProtect_Protected
{
    meta:
        description = "Detects VMProtect protected executables"
        author = "BytesRevealer"

    strings:
        $vmp0 = ".vmp0" ascii
        $vmp1 = ".vmp1" ascii
        $vmp2 = "VMProtect" ascii

    condition:
        any of them
}

rule PECompact_Packed
{
    meta:
        description = "Detects PECompact packed executables"
        author = "BytesRevealer"

    strings:
        $pec1 = "PECompact2" ascii
        $pec2 = "PEC2" ascii

    condition:
        any of them
}

rule MPRESS_Packed
{
    meta:
        description = "Detects MPRESS packed executables"
        author = "BytesRevealer"

    strings:
        $mpress1 = ".MPRESS1" ascii
        $mpress2 = ".MPRESS2" ascii

    condition:
        any of them
}`
  },
  {
    id: 'suspicious_strings',
    name: 'Suspicious Strings',
    description:
      'Debug strings, registry persistence keys, suspicious commands, and indicators of compromise',
    rules: `rule Persistence_Registry_Keys
{
    meta:
        description = "References to Windows registry keys commonly used for persistence"
        author = "BytesRevealer"

    strings:
        $r1 = "CurrentVersion\\\\Run" ascii nocase
        $r2 = "CurrentVersion\\\\RunOnce" ascii nocase
        $r3 = "CurrentVersion\\\\Policies\\\\Explorer\\\\Run" ascii nocase
        $r4 = "CurrentVersion\\\\Windows\\\\Load" ascii nocase
        $r5 = "Environment\\\\UserInitMprLogonScript" ascii nocase

    condition:
        any of them
}

rule Suspicious_Commands
{
    meta:
        description = "Suspicious system commands used for reconnaissance or evasion"
        author = "BytesRevealer"

    strings:
        $c1 = "whoami" ascii nocase
        $c2 = "net user" ascii nocase
        $c3 = "net localgroup" ascii nocase
        $c4 = "systeminfo" ascii nocase
        $c5 = "tasklist" ascii nocase
        $c6 = "ipconfig /all" ascii nocase
        $c7 = "netstat" ascii nocase
        $c8 = "schtasks" ascii nocase
        $c9 = "wmic" ascii nocase
        $c10 = "bcdedit" ascii nocase

    condition:
        3 of them
}

rule Debug_Artifact_Strings
{
    meta:
        description = "Debug and development artifact strings left in binaries"
        author = "BytesRevealer"

    strings:
        $d1 = "TODO:" ascii
        $d2 = "FIXME:" ascii
        $d3 = "HACK:" ascii
        $d4 = "DEBUG" ascii
        $d5 = "\\\\Debug\\\\" ascii
        $d6 = ".pdb" ascii

    condition:
        2 of them
}

rule Network_Indicators
{
    meta:
        description = "Network-related strings that may indicate C2 communication"
        author = "BytesRevealer"

    strings:
        $n1 = "User-Agent:" ascii
        $n2 = "POST " ascii
        $n3 = "Content-Type:" ascii
        $n4 = "/gate.php" ascii
        $n5 = "/panel/" ascii
        $n6 = "Mozilla/5.0" ascii
        $n7 = "XMLHttpRequest" ascii

    condition:
        3 of them
}`
  }
]
