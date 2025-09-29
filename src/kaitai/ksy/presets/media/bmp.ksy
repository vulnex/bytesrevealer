meta:
  id: bmp
  title: Windows Bitmap
  file-extension: bmp
  endian: le
  
seq:
  - id: file_header
    type: file_header
  - id: dib_header_size
    type: u4
  - id: dib_header
    size: dib_header_size - 4
    type:
      switch-on: dib_header_size
      cases:
        40: bitmap_info_header
        108: bitmap_v4_header
        124: bitmap_v5_header
        
types:
  file_header:
    seq:
      - id: magic
        contents: 'BM'
      - id: file_size
        type: u4
      - id: reserved1
        type: u2
      - id: reserved2
        type: u2
      - id: bitmap_offset
        type: u4
        doc: Offset to bitmap data
        
  bitmap_info_header:
    seq:
      - id: width
        type: s4
      - id: height
        type: s4
      - id: color_planes
        type: u2
      - id: bits_per_pixel
        type: u2
      - id: compression
        type: u4
        enum: compression_type
      - id: image_size
        type: u4
      - id: x_pixels_per_meter
        type: s4
      - id: y_pixels_per_meter
        type: s4
      - id: colors_used
        type: u4
      - id: colors_important
        type: u4
        
  bitmap_v4_header:
    seq:
      - id: width
        type: s4
      - id: height
        type: s4
      - id: color_planes
        type: u2
      - id: bits_per_pixel
        type: u2
      - id: compression
        type: u4
        enum: compression_type
      - id: image_size
        type: u4
      - id: x_pixels_per_meter
        type: s4
      - id: y_pixels_per_meter
        type: s4
      - id: colors_used
        type: u4
      - id: colors_important
        type: u4
      - id: red_mask
        type: u4
      - id: green_mask
        type: u4
      - id: blue_mask
        type: u4
      - id: alpha_mask
        type: u4
      - id: color_space_type
        type: u4
      - id: endpoints
        size: 36
      - id: gamma_red
        type: u4
      - id: gamma_green
        type: u4
      - id: gamma_blue
        type: u4
        
  bitmap_v5_header:
    seq:
      - id: width
        type: s4
      - id: height
        type: s4
      - id: color_planes
        type: u2
      - id: bits_per_pixel
        type: u2
      - id: compression
        type: u4
        enum: compression_type
      - id: image_size
        type: u4
      - id: x_pixels_per_meter
        type: s4
      - id: y_pixels_per_meter
        type: s4
      - id: colors_used
        type: u4
      - id: colors_important
        type: u4
      - id: red_mask
        type: u4
      - id: green_mask
        type: u4
      - id: blue_mask
        type: u4
      - id: alpha_mask
        type: u4
      - id: color_space_type
        type: u4
      - id: endpoints
        size: 36
      - id: gamma_red
        type: u4
      - id: gamma_green
        type: u4
      - id: gamma_blue
        type: u4
      - id: intent
        type: u4
      - id: profile_data
        type: u4
      - id: profile_size
        type: u4
      - id: reserved
        type: u4
        
enums:
  compression_type:
    0: rgb
    1: rle8
    2: rle4
    3: bitfields
    4: jpeg
    5: png