/**
 * Kaitai Formats - CAD
 * 1 formats
 * Auto-generated: 2025-09-21T19:51:05.638Z
 */

export const cadFormats = [
  {
    "id": "ksy_monomakh_sapr_chg",
    "name": "Monomakh Sapr Chg",
    "category": "CAD",
    "metadata": {
      "isGenerated": true,
      "fileExtensions": [
        "chg"
      ],
      "description": "",
      "originalCategory": "cad",
      "filePath": "cad/monomakh_sapr_chg.ksy",
      "endian": "le"
    },
    "content": "meta:\n  id: monomakh_sapr_chg\n  application: MONOMAKH-SAPR\n  file-extension: chg\n  license: CC0-1.0\n  ks-version: 0.7\n  endian: le\ndoc: |\n  CHG is a container format file used by\n  [MONOMAKH-SAPR](https://www.liraland.com/mono/), a software\n  package for analysis & design of reinforced concrete multi-storey\n  buildings with arbitrary configuration in plan.\n\n  CHG is a simple container, which bundles several project files\n  together.\n\n  Written and tested by Vladimir Shulzhitskiy, 2017\nseq:\n  - id: title\n    type: str\n    size: 10\n    encoding: \"ascii\"\n  - id: ent\n    type: block\n    repeat: eos\ntypes:\n  block:\n    seq:\n      - id: header\n        type: str\n        size: 13\n        encoding: \"ascii\"\n      - id: file_size\n        type: u8\n      - id: file\n        size: file_size\n"
  }
];

export default {
  category: "CAD",
  formats: cadFormats
};
