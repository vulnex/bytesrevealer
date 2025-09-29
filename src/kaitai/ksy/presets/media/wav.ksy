meta:
  id: wav
  title: WAV audio file
  file-extension: wav
  endian: le
  
seq:
  - id: riff
    type: riff_chunk
    
types:
  riff_chunk:
    seq:
      - id: magic
        contents: 'RIFF'
      - id: file_size
        type: u4
        doc: File size minus 8 bytes
      - id: wave_id
        contents: 'WAVE'
      - id: chunks
        type: chunk
        repeat: eos
        
  chunk:
    seq:
      - id: chunk_id
        type: str
        size: 4
        encoding: ASCII
      - id: chunk_size
        type: u4
      - id: data
        size: chunk_size
        type:
          switch-on: chunk_id
          cases:
            '"fmt "': format_chunk
            '"data"': data_chunk
            '"LIST"': list_chunk
            
  format_chunk:
    seq:
      - id: audio_format
        type: u2
        enum: audio_format
      - id: num_channels
        type: u2
      - id: sample_rate
        type: u4
      - id: byte_rate
        type: u4
      - id: block_align
        type: u2
      - id: bits_per_sample
        type: u2
      - id: extra_params
        size-eos: true
        if: audio_format != audio_format::pcm
        
  data_chunk:
    seq:
      - id: samples
        size-eos: true
        doc: Raw audio samples
        
  list_chunk:
    seq:
      - id: list_type
        type: str
        size: 4
        encoding: ASCII
      - id: data
        size-eos: true
        
enums:
  audio_format:
    0x0001: pcm
    0x0002: adpcm
    0x0003: ieee_float
    0x0006: alaw
    0x0007: mulaw
    0x0011: dvi_adpcm
    0x0016: mpeg
    0x0031: gsm610
    0x0040: g721_adpcm
    0x0050: mpeg_layer3
    0x0055: mp3
    0x0401: intel_music_coder
    0x0402: indeo_audio
    0x1000: creative_adpcm
    0x1001: creative_fastspeech8
    0x1002: creative_fastspeech10
    0x2000: dolby_ac3
    0xfffe: extensible