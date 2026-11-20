// Issuing states of travel documents: the three letter codes of the MRZ (ISO 3166-1 alpha-3, with the special ICAO codes) and their names.
// Pure data. `D` = Germany is the ONE short code of the MRZ (the German ID card and passport write `D`).

const ISO = `AFG:Afghanistan|ALA:Åland Islands|ALB:Albania|DZA:Algeria|ASM:American Samoa|AND:Andorra|AGO:Angola|AIA:Anguilla|ATA:Antarctica|ATG:Antigua and Barbuda|ARG:Argentina|ARM:Armenia|ABW:Aruba|AUS:Australia|AUT:Austria|AZE:Azerbaijan|BHS:Bahamas|BHR:Bahrain|BGD:Bangladesh|BRB:Barbados|BLR:Belarus|BEL:Belgium|BLZ:Belize|BEN:Benin|BMU:Bermuda|BTN:Bhutan|BOL:Bolivia|BES:Bonaire, Sint Eustatius and Saba|BIH:Bosnia and Herzegovina|BWA:Botswana|BVT:Bouvet Island|BRA:Brazil|IOT:British Indian Ocean Territory|BRN:Brunei|BGR:Bulgaria|BFA:Burkina Faso|BDI:Burundi|CPV:Cabo Verde|KHM:Cambodia|CMR:Cameroon|CAN:Canada|CYM:Cayman Islands|CAF:Central African Republic|TCD:Chad|CHL:Chile|CHN:China|CXR:Christmas Island|CCK:Cocos (Keeling) Islands|COL:Colombia|COM:Comoros|COG:Congo|COD:Congo (Democratic Republic)|COK:Cook Islands|CRI:Costa Rica|CIV:Côte d'Ivoire|HRV:Croatia|CUB:Cuba|CUW:Curaçao|CYP:Cyprus|CZE:Czechia|DNK:Denmark|DJI:Djibouti|DMA:Dominica|DOM:Dominican Republic|ECU:Ecuador|EGY:Egypt|SLV:El Salvador|GNQ:Equatorial Guinea|ERI:Eritrea|EST:Estonia|SWZ:Eswatini|ETH:Ethiopia|FLK:Falkland Islands|FRO:Faroe Islands|FJI:Fiji|FIN:Finland|FRA:France|GUF:French Guiana|PYF:French Polynesia|ATF:French Southern Territories|GAB:Gabon|GMB:Gambia|GEO:Georgia|DEU:Germany|GHA:Ghana|GIB:Gibraltar|GRC:Greece|GRL:Greenland|GRD:Grenada|GLP:Guadeloupe|GUM:Guam|GTM:Guatemala|GGY:Guernsey|GIN:Guinea|GNB:Guinea-Bissau|GUY:Guyana|HTI:Haiti|HMD:Heard Island and McDonald Islands|VAT:Holy See|HND:Honduras|HKG:Hong Kong|HUN:Hungary|ISL:Iceland|IND:India|IDN:Indonesia|IRN:Iran|IRQ:Iraq|IRL:Ireland|IMN:Isle of Man|ISR:Israel|ITA:Italy|JAM:Jamaica|JPN:Japan|JEY:Jersey|JOR:Jordan|KAZ:Kazakhstan|KEN:Kenya|KIR:Kiribati|PRK:North Korea|KOR:South Korea|KWT:Kuwait|KGZ:Kyrgyzstan|LAO:Laos|LVA:Latvia|LBN:Lebanon|LSO:Lesotho|LBR:Liberia|LBY:Libya|LIE:Liechtenstein|LTU:Lithuania|LUX:Luxembourg|MAC:Macao|MDG:Madagascar|MWI:Malawi|MYS:Malaysia|MDV:Maldives|MLI:Mali|MLT:Malta|MHL:Marshall Islands|MTQ:Martinique|MRT:Mauritania|MUS:Mauritius|MYT:Mayotte|MEX:Mexico|FSM:Micronesia|MDA:Moldova|MCO:Monaco|MNG:Mongolia|MNE:Montenegro|MSR:Montserrat|MAR:Morocco|MOZ:Mozambique|MMR:Myanmar|NAM:Namibia|NRU:Nauru|NPL:Nepal|NLD:Netherlands|NCL:New Caledonia|NZL:New Zealand|NIC:Nicaragua|NER:Niger|NGA:Nigeria|NIU:Niue|NFK:Norfolk Island|MKD:North Macedonia|MNP:Northern Mariana Islands|NOR:Norway|OMN:Oman|PAK:Pakistan|PLW:Palau|PSE:Palestine|PAN:Panama|PNG:Papua New Guinea|PRY:Paraguay|PER:Peru|PHL:Philippines|PCN:Pitcairn|POL:Poland|PRT:Portugal|PRI:Puerto Rico|QAT:Qatar|REU:Réunion|ROU:Romania|RUS:Russia|RWA:Rwanda|BLM:Saint Barthélemy|SHN:Saint Helena|KNA:Saint Kitts and Nevis|LCA:Saint Lucia|MAF:Saint Martin|SPM:Saint Pierre and Miquelon|VCT:Saint Vincent and the Grenadines|WSM:Samoa|SMR:San Marino|STP:Sao Tome and Principe|SAU:Saudi Arabia|SEN:Senegal|SRB:Serbia|SYC:Seychelles|SLE:Sierra Leone|SGP:Singapore|SXM:Sint Maarten|SVK:Slovakia|SVN:Slovenia|SLB:Solomon Islands|SOM:Somalia|ZAF:South Africa|SGS:South Georgia and the South Sandwich Islands|SSD:South Sudan|ESP:Spain|LKA:Sri Lanka|SDN:Sudan|SUR:Suriname|SJM:Svalbard and Jan Mayen|SWE:Sweden|CHE:Switzerland|SYR:Syria|TWN:Taiwan|TJK:Tajikistan|TZA:Tanzania|THA:Thailand|TLS:Timor-Leste|TGO:Togo|TKL:Tokelau|TON:Tonga|TTO:Trinidad and Tobago|TUN:Tunisia|TUR:Türkiye|TKM:Turkmenistan|TCA:Turks and Caicos Islands|TUV:Tuvalu|UGA:Uganda|UKR:Ukraine|ARE:United Arab Emirates|GBR:United Kingdom|USA:United States|UMI:United States Minor Outlying Islands|URY:Uruguay|UZB:Uzbekistan|VUT:Vanuatu|VEN:Venezuela|VNM:Vietnam|VGB:British Virgin Islands|VIR:US Virgin Islands|WLF:Wallis and Futuna|ESH:Western Sahara|YEM:Yemen|ZMB:Zambia|ZWE:Zimbabwe`;

/** codes of the MRZ that are not ISO 3166 countries (ICAO 9303 part 3) */
const SPECIAL = `D:Germany|GBD:British Overseas Territories citizen|GBN:British National (Overseas)|GBO:British Overseas citizen|GBP:British Protected person|GBS:British Subject|RKS:Kosovo|UNK:Kosovo (UNMIK)|UNO:United Nations Organization|UNA:United Nations specialized agency|EUE:European Union|XOM:Sovereign Military Order of Malta|XXA:Stateless person|XXB:Refugee|XXC:Refugee (other)|XXX:Nationality unspecified|XBA:African Development Bank|XIM:African Export-Import Bank|XCC:Caribbean Community|XCO:Common Market for Eastern and Southern Africa|XEC:Economic Community of West African States|XPO:International Criminal Police Organization|XES:Organization of Eastern Caribbean States|XDC:Southern African Development Community|ZZZ:Unknown`;

const toMap = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const pair of text.split('|')) {
    const i = pair.indexOf(':');
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
};

export const COUNTRY_NAMES: Record<string, string> = { ...toMap(ISO), ...toMap(SPECIAL) };

/** 'LVA' -> 'Latvia'; the unknown code is returned as it is */
export function countryName(code: string | undefined | null): string {
  const c = String(code ?? '').trim().toUpperCase().replace(/</g, '');
  return COUNTRY_NAMES[c] ?? c;
}

/** the codes of the countries (no special ones), name sorted: the list for a picker */
export function countryList(): Array<{ code: string; name: string }> {
  const special = new Set(Object.keys(toMap(SPECIAL)));
  return Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !special.has(code) || code === 'D')
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** the MRZ writes `D` for Germany; the ISO code is DEU: both mean the same state */
export const normalizeStateCode = (code: string): string => {
  const c = String(code ?? '').trim().toUpperCase().replace(/</g, '');
  return c === 'D' ? 'DEU' : c;
};
