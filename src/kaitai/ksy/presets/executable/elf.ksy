meta:
  id: elf
  title: Executable and Linkable Format
  file-extension:
    - elf
    - so
    - o
  endian: le
  
seq:
  - id: magic
    contents: [0x7f, 0x45, 0x4c, 0x46]
  - id: bits
    type: u1
    enum: bits
  - id: endian
    type: u1
    enum: endian
  - id: ei_version
    type: u1
  - id: abi
    type: u1
    enum: os_abi
  - id: abi_version
    type: u1
  - id: pad
    size: 7
  - id: header
    type:
      switch-on: bits
      cases:
        'bits::b32': header32
        'bits::b64': header64
        
types:
  header32:
    seq:
      - id: e_type
        type: u2
        enum: obj_type
      - id: machine
        type: u2
        enum: machine
      - id: e_version
        type: u4
      - id: entry_point
        type: u4
      - id: program_header_offset
        type: u4
      - id: section_header_offset
        type: u4
      - id: flags
        type: u4
      - id: e_ehsize
        type: u2
      - id: program_header_entry_size
        type: u2
      - id: num_program_headers
        type: u2
      - id: section_header_entry_size
        type: u2
      - id: num_section_headers
        type: u2
      - id: string_table_idx
        type: u2
        
  header64:
    seq:
      - id: e_type
        type: u2
        enum: obj_type
      - id: machine
        type: u2
        enum: machine
      - id: e_version
        type: u4
      - id: entry_point
        type: u8
      - id: program_header_offset
        type: u8
      - id: section_header_offset
        type: u8
      - id: flags
        type: u4
      - id: e_ehsize
        type: u2
      - id: program_header_entry_size
        type: u2
      - id: num_program_headers
        type: u2
      - id: section_header_entry_size
        type: u2
      - id: num_section_headers
        type: u2
      - id: string_table_idx
        type: u2
        
enums:
  bits:
    1: b32
    2: b64
    
  endian:
    1: le
    2: be
    
  os_abi:
    0: system_v
    1: hp_ux
    2: netbsd
    3: linux
    6: solaris
    7: aix
    8: irix
    9: freebsd
    12: openbsd
    
  obj_type:
    0: none
    1: relocatable
    2: executable
    3: shared
    4: core
    
  machine:
    0x00: none
    0x02: sparc
    0x03: x86
    0x08: mips
    0x14: powerpc
    0x16: s390
    0x28: arm
    0x2a: superh
    0x32: ia64
    0x3e: x86_64
    0xb7: aarch64
    0xf3: riscv