meta:
  id: png
  title: PNG (Portable Network Graphics) image file
  file-extension: png
  xref:
    forensicswiki: portable_network_graphics_(png)
    iso: 15948:2004
    loc: fdd000153
    mime: image/png
    pronom: fmt/11
    pronom: fmt/12
    pronom: fmt/13
    rfc: 2083
    wikidata: Q178051
  endian: be
  license: CC0-1.0

seq:
  - id: magic
    contents: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  - id: ihdr_len
    contents: [0x00, 0x00, 0x00, 0x0d]
  - id: ihdr_type
    contents: [0x49, 0x48, 0x44, 0x52]
  - id: ihdr
    type: ihdr_chunk
  - id: ihdr_crc
    type: u4
  - id: chunks
    type: chunk
    repeat: until
    repeat-until: _.type == "IEND" or _io.eof

types:
  chunk:
    seq:
      - id: len
        type: u4
      - id: type
        type: str
        size: 4
        encoding: UTF-8
      - id: body
        size: len
        type:
          switch-on: type
          cases:
            '"PLTE"': plte_chunk
            '"tRNS"': trns_chunk
            '"gAMA"': gama_chunk
            '"pHYs"': phys_chunk
            '"tIME"': time_chunk
            '"tEXt"': text_chunk
            '"iTXt"': international_text_chunk
      - id: crc
        type: u4

  ihdr_chunk:
    seq:
      - id: width
        type: u4
      - id: height
        type: u4
      - id: bit_depth
        type: u1
      - id: color_type
        type: u1
        enum: color_type
      - id: compression_method
        type: u1
      - id: filter_method
        type: u1
      - id: interlace_method
        type: u1

  plte_chunk:
    seq:
      - id: entries
        type: rgb
        repeat: eos

  rgb:
    seq:
      - id: r
        type: u1
      - id: g
        type: u1
      - id: b
        type: u1

  trns_chunk:
    seq:
      - id: transparent_color_gray
        type: u2
        if: _root.ihdr.color_type == color_type::grayscale
      - id: transparent_color_truecolor
        type: rgb
        if: _root.ihdr.color_type == color_type::truecolor
      - id: palette_alpha
        type: u1
        repeat: eos
        if: _root.ihdr.color_type == color_type::indexed

  gama_chunk:
    seq:
      - id: gamma
        type: u4

  phys_chunk:
    seq:
      - id: pixels_per_unit_x
        type: u4
      - id: pixels_per_unit_y
        type: u4
      - id: unit
        type: u1
        enum: phys_unit

  time_chunk:
    seq:
      - id: year
        type: u2
      - id: month
        type: u1
      - id: day
        type: u1
      - id: hour
        type: u1
      - id: minute
        type: u1
      - id: second
        type: u1

  text_chunk:
    seq:
      - id: keyword
        type: strz
        encoding: UTF-8
      - id: text
        type: str
        size-eos: true
        encoding: UTF-8

  international_text_chunk:
    seq:
      - id: keyword
        type: strz
        encoding: UTF-8
      - id: compression_flag
        type: u1
      - id: compression_method
        type: u1
      - id: language_tag
        type: strz
        encoding: ASCII
      - id: translated_keyword
        type: strz
        encoding: UTF-8
      - id: text
        type: str
        size-eos: true
        encoding: UTF-8

enums:
  color_type:
    0: grayscale
    2: truecolor
    3: indexed
    4: grayscale_alpha
    6: truecolor_alpha

  phys_unit:
    0: unknown
    1: meter