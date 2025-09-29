/**
 * Kaitai Formats - 3D Graphics
 * 1 formats
 * Auto-generated: 2025-09-21T19:51:05.638Z
 */

export const cat_3d_graphicsFormats = [
  {
    "id": "ksy_gltf_binary",
    "name": "GL Transmission Format, binary container",
    "category": "3D Graphics",
    "metadata": {
      "isGenerated": true,
      "fileExtensions": [
        "glb"
      ],
      "description": "GL Transmission Format, binary container",
      "originalCategory": "3d",
      "filePath": "3d/gltf_binary.ksy",
      "endian": "le"
    },
    "content": "meta:\n  id: gltf_binary\n  title: GL Transmission Format, binary container\n  file-extension: glb\n  xref:\n    justsolve: GlTF\n    mime: model/gltf-binary\n    wikidata: Q28135989\n  license: MIT\n  endian: le\n\ndoc: |\n  glTF is a format for distribution of 3D models optimized for being used in software\n\ndoc-ref: https://github.com/KhronosGroup/glTF/tree/2354846/specification/2.0#binary-gltf-layout\n\nseq:\n  - id: header\n    type: header\n  - id: chunks\n    type: chunk\n    repeat: eos\n\ntypes:\n\n  header:\n    seq:\n      - id: magic\n        contents: glTF\n      - id: version\n        type: u4\n        doc: |\n          Indicates the version of the Binary glTF container format.\n          For this specification, should be set to 2.\n      - id: length\n        type: u4\n        doc: Total length of the Binary glTF, including Header and all Chunks, in bytes.\n\n  chunk:\n    seq:\n      - id: len_data\n        type: u4\n      - id: type\n        type: u4\n        enum: chunk_type\n      - id: data\n        size: len_data\n        type:\n          switch-on: type\n          cases:\n            'chunk_type::json': json\n            'chunk_type::bin': bin\n\n  json:\n    seq:\n      - id: data\n        size-eos: true\n        type: str\n        encoding: UTF-8\n        doc: |\n          This is where GLB deviates from being an elegant format.\n          To parse the rest of the file, you have to parse the JSON first.\n\n  bin:\n    seq:\n      - id: data\n        size-eos: true\n\nenums:\n  chunk_type:\n    0x4E4F534A: json # \"JSON\"\n    0x004E4942: bin  # \"BIN\\0\"\n"
  }
];

export default {
  category: "3D Graphics",
  formats: cat_3d_graphicsFormats
};
