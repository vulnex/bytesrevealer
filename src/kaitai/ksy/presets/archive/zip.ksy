meta:
  id: zip
  title: ZIP archive
  file-extension:
    - zip
    - jar
    - apk
    - docx
    - xlsx
    - pptx
  endian: le
  
seq:
  - id: sections
    type: section
    repeat: eos
    
types:
  section:
    seq:
      - id: magic
        type: u4
      - id: body
        type:
          switch-on: magic
          cases:
            0x04034b50: local_file
            0x02014b50: central_dir_entry
            0x06054b50: end_of_central_dir
            0x08074b50: data_descriptor
            
  local_file:
    seq:
      - id: version_to_extract
        type: u2
      - id: flags
        type: u2
      - id: compression_method
        type: u2
      - id: last_mod_time
        type: u2
      - id: last_mod_date
        type: u2
      - id: crc32
        type: u4
      - id: compressed_size
        type: u4
      - id: uncompressed_size
        type: u4
      - id: file_name_len
        type: u2
      - id: extra_len
        type: u2
      - id: file_name
        type: str
        size: file_name_len
        encoding: UTF-8
      - id: extra
        size: extra_len
      - id: body
        size: compressed_size
        
  central_dir_entry:
    seq:
      - id: version_made_by
        type: u2
      - id: version_to_extract
        type: u2
      - id: flags
        type: u2
      - id: compression_method
        type: u2
      - id: last_mod_time
        type: u2
      - id: last_mod_date
        type: u2
      - id: crc32
        type: u4
      - id: compressed_size
        type: u4
      - id: uncompressed_size
        type: u4
      - id: file_name_len
        type: u2
      - id: extra_len
        type: u2
      - id: comment_len
        type: u2
      - id: disk_number_start
        type: u2
      - id: internal_attr
        type: u2
      - id: external_attr
        type: u4
      - id: local_header_offset
        type: u4
      - id: file_name
        type: str
        size: file_name_len
        encoding: UTF-8
      - id: extra
        size: extra_len
      - id: comment
        type: str
        size: comment_len
        encoding: UTF-8
        
  end_of_central_dir:
    seq:
      - id: disk_num
        type: u2
      - id: disk_num_central_dir
        type: u2
      - id: num_entries_this_disk
        type: u2
      - id: num_entries_total
        type: u2
      - id: central_dir_size
        type: u4
      - id: central_dir_offset
        type: u4
      - id: comment_len
        type: u2
      - id: comment
        type: str
        size: comment_len
        encoding: UTF-8
        
  data_descriptor:
    seq:
      - id: crc32
        type: u4
      - id: compressed_size
        type: u4
      - id: uncompressed_size
        type: u4