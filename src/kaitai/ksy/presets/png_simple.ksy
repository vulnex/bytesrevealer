meta:
  id: png_simple
  title: PNG (Simplified)
  file-extension: png
  endian: be

seq:
  - id: magic
    contents: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  - id: ihdr_len
    type: u4
  - id: ihdr_type
    type: str
    size: 4
    encoding: ASCII
  - id: ihdr_width
    type: u4
  - id: ihdr_height
    type: u4
  - id: ihdr_bit_depth
    type: u1
  - id: ihdr_color_type
    type: u1
  - id: ihdr_compression
    type: u1
  - id: ihdr_filter
    type: u1
  - id: ihdr_interlace
    type: u1
  - id: ihdr_crc
    type: u4