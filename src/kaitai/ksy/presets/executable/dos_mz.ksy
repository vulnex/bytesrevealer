meta:
  id: dos_mz
  title: DOS MZ executable
  file-extension:
    - exe
    - dll
    - sys
  endian: le
  
seq:
  - id: header
    type: mz_header
  - id: relocations
    type: relocation
    repeat: expr
    repeat-expr: header.num_relocations
  - id: body
    size-eos: true
    
types:
  mz_header:
    seq:
      - id: magic
        contents: [0x4d, 0x5a]  # "MZ"
      - id: bytes_in_last_page
        type: u2
      - id: num_pages
        type: u2
      - id: num_relocations
        type: u2
      - id: header_size_paragraphs
        type: u2
      - id: min_extra_paragraphs
        type: u2
      - id: max_extra_paragraphs
        type: u2
      - id: initial_ss
        type: u2
      - id: initial_sp
        type: u2
      - id: checksum
        type: u2
      - id: initial_ip
        type: u2
      - id: initial_cs
        type: u2
      - id: ofs_relocations
        type: u2
      - id: overlay_num
        type: u2
      - id: reserved
        size: 32
      - id: ofs_pe_header
        type: u4
        
  relocation:
    seq:
      - id: offset
        type: u2
      - id: segment
        type: u2