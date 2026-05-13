// Maps project_coverage strings to ISO-3166-1 numeric country codes used by world-atlas TopoJSON.
// null = highlight all countries (Global / All LMICs)
export const COVERAGE_COUNTRY_IDS: Record<string, number[] | null> = {
  Global: null,
  "All low-and middle-income countries": null,

  Kenya: [404],

  "Somalia, South Sudan": [706, 728],

  "East Africa": [
    108, // Burundi
    174, // Comoros
    262, // Djibouti
    232, // Eritrea
    231, // Ethiopia
    404, // Kenya
    450, // Madagascar
    454, // Malawi
    480, // Mauritius
    508, // Mozambique
    646, // Rwanda
    690, // Seychelles
    706, // Somalia
    728, // South Sudan
    834, // Tanzania
    800, // Uganda
    894, // Zambia
    716, // Zimbabwe
  ],

  "East Africa & MENA": [
    // East Africa
    108,
    174,
    262,
    232,
    231,
    404,
    450,
    454,
    480,
    508,
    646,
    690,
    706,
    728,
    834,
    800,
    894,
    716,
    // MENA
    12, // Algeria
    48, // Bahrain
    818, // Egypt
    364, // Iran
    368, // Iraq
    376, // Israel
    400, // Jordan
    414, // Kuwait
    422, // Lebanon
    434, // Libya
    504, // Morocco
    512, // Oman
    275, // Palestine
    634, // Qatar
    682, // Saudi Arabia
    760, // Syria
    788, // Tunisia
    792, // Turkey
    784, // UAE
    887, // Yemen
  ],

  "West and East Africa": [
    // East Africa
    108,
    174,
    262,
    232,
    231,
    404,
    450,
    454,
    480,
    508,
    646,
    690,
    706,
    728,
    834,
    800,
    894,
    716,
    // West Africa
    204, // Benin
    854, // Burkina Faso
    132, // Cape Verde
    384, // Côte d'Ivoire
    270, // Gambia
    288, // Ghana
    324, // Guinea
    624, // Guinea-Bissau
    430, // Liberia
    466, // Mali
    478, // Mauritania
    562, // Niger
    566, // Nigeria
    686, // Senegal
    694, // Sierra Leone
    768, // Togo
  ],

  "Middle East, Central & West Africa": [
    // MENA
    12,
    48,
    818,
    364,
    368,
    376,
    400,
    414,
    422,
    434,
    504,
    512,
    275,
    634,
    682,
    760,
    788,
    792,
    784,
    887,
    // Central Africa
    24, // Angola
    120, // Cameroon
    140, // Central African Republic
    148, // Chad
    178, // Republic of Congo
    180, // DRC
    226, // Equatorial Guinea
    266, // Gabon
    678, // São Tomé and Príncipe
    // West Africa
    204,
    854,
    132,
    384,
    270,
    288,
    324,
    624,
    430,
    466,
    478,
    562,
    566,
    686,
    694,
    768,
  ],
};
