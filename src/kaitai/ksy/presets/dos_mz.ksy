meta:
  id: dos_mz
  title: DOS MZ executable and PE/PE+ executable
  file-extension:
    - exe
    - dll
    - sys
  xref:
    justsolve: MZ
    justsolve: Portable_Executable
    pronom: x-fmt/409
    pronom: x-fmt/410
    pronom: x-fmt/411
    pronom: x-fmt/412
    pronom: x-fmt/413
    wikidata: Q1076355
    wikidata: Q1195782
  license: CC0-1.0
  endian: le

seq:
  - id: mz_header
    type: mz_header
  - id: mz_body
    size: mz_header.len_body
  - id: pe_header
    type: pe_header
    if: mz_header.ofs_pe != 0 and mz_header.ofs_pe < _io.size

types:
  mz_header:
    seq:
      - id: magic
        contents: MZ
      - id: bytes_in_last_page
        type: u2
      - id: pages_in_file
        type: u2
      - id: num_relocations
        type: u2
      - id: header_size_paragraphs
        type: u2
      - id: min_extra_paragraphs
        type: u2
      - id: max_extra_paragraphs
        type: u2
      - id: initial_relative_ss
        type: u2
      - id: initial_sp
        type: u2
      - id: checksum
        type: u2
      - id: initial_ip
        type: u2
      - id: initial_relative_cs
        type: u2
      - id: addr_relocation_table
        type: u2
      - id: overlay_num
        type: u2
      - id: reserved
        type: u2
        repeat: expr
        repeat-expr: 4
      - id: oem_id
        type: u2
      - id: oem_info
        type: u2
      - id: reserved2
        type: u2
        repeat: expr
        repeat-expr: 10
      - id: ofs_pe
        type: u4
    instances:
      len_body:
        value: |
          ofs_pe == 0 ? _io.size - header_size_paragraphs * 16 :
          ofs_pe - header_size_paragraphs * 16

  pe_header:
    seq:
      - id: pe_signature
        contents: [0x50, 0x45, 0x00, 0x00]
      - id: coff_header
        type: coff_header
      - id: optional_header
        type: optional_header
        size: coff_header.size_of_optional_header
        if: coff_header.size_of_optional_header > 0
      - id: sections
        type: section
        repeat: expr
        repeat-expr: coff_header.number_of_sections

  coff_header:
    seq:
      - id: machine
        type: u2
        enum: machine_type
      - id: number_of_sections
        type: u2
      - id: time_date_stamp
        type: u4
      - id: pointer_to_symbol_table
        type: u4
      - id: number_of_symbols
        type: u4
      - id: size_of_optional_header
        type: u2
      - id: characteristics
        type: u2

  optional_header:
    seq:
      - id: magic
        type: u2
        enum: pe_format
      - id: major_linker_version
        type: u1
      - id: minor_linker_version
        type: u1
      - id: size_of_code
        type: u4
      - id: size_of_initialized_data
        type: u4
      - id: size_of_uninitialized_data
        type: u4
      - id: address_of_entry_point
        type: u4
      - id: base_of_code
        type: u4
      - id: base_of_data
        type: u4
        if: magic == pe_format::pe32
      - id: image_base
        type:
          switch-on: magic
          cases:
            pe_format::pe32: u4
            pe_format::pe32_plus: u8
      - id: section_alignment
        type: u4
      - id: file_alignment
        type: u4
      - id: major_os_version
        type: u2
      - id: minor_os_version
        type: u2
      - id: major_image_version
        type: u2
      - id: minor_image_version
        type: u2
      - id: major_subsystem_version
        type: u2
      - id: minor_subsystem_version
        type: u2
      - id: win32_version_value
        type: u4
      - id: size_of_image
        type: u4
      - id: size_of_headers
        type: u4
      - id: checksum
        type: u4
      - id: subsystem
        type: u2
        enum: subsystem_enum
      - id: dll_characteristics
        type: u2

  section:
    seq:
      - id: name
        type: str
        size: 8
        encoding: UTF-8
        pad-right: 0
      - id: virtual_size
        type: u4
      - id: virtual_address
        type: u4
      - id: size_of_raw_data
        type: u4
      - id: pointer_to_raw_data
        type: u4
      - id: pointer_to_relocations
        type: u4
      - id: pointer_to_line_numbers
        type: u4
      - id: number_of_relocations
        type: u2
      - id: number_of_line_numbers
        type: u2
      - id: characteristics
        type: u4

enums:
  machine_type:
    0x0: unknown
    0x14c: i386
    0x162: r3000
    0x166: r4000
    0x168: r10000
    0x169: wcemipsv2
    0x184: alpha
    0x1a2: sh3
    0x1a3: sh3dsp
    0x1a4: sh3e
    0x1a6: sh4
    0x1a8: sh5
    0x1c0: arm
    0x1c2: thumb
    0x1c4: armnt
    0x1d3: am33
    0x1f0: powerpc
    0x1f1: powerpcfp
    0x200: ia64
    0x266: mips16
    0x284: alpha64
    0x366: mipsfpu
    0x466: mipsfpu16
    0x520: tricore
    0xcef: cef
    0xebc: ebc
    0x8664: amd64
    0x9041: m32r
    0xc0ee: cee

  pe_format:
    0x10b: pe32
    0x20b: pe32_plus

  subsystem_enum:
    0: unknown
    1: native
    2: windows_gui
    3: windows_console
    7: posix_console
    9: windows_ce_gui
    10: efi_application
    11: efi_boot_service_driver
    12: efi_runtime_driver
    13: efi_rom
    14: xbox
    16: windows_boot_application