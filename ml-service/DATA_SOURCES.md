# Data Sources

Every source Estovia is allowed to touch is declared in code, not in prose, in
`estovia_ml/sources.py`. That registry also keeps the sources we investigated and
**rejected**, so nobody can later "fix" the pipeline by pointing at a source we
already proved unusable. The numbers below come from
`data/processed/ingestion_log.json` and `artifacts/registry.json`.

## Sources actually ingested

| Source | Data Type | Geographic Coverage | Access Method | Actual Records Obtained | Target Type | License / Restrictions |
| --- | --- | --- | --- | --- | --- | --- |
| Housing Price Dataset of Delhi (`Delhi_v2.csv`) — `kaggle_delhi_ncr_housing_v2` | Property listing rows with latitude/longitude per row | Delhi NCR — Delhi, Ghaziabad, Gurugram, Noida, Greater Noida, Faridabad | Kaggle public dataset download API, no credentials required | **7,596** accepted from 7,738 raw | `asking_price` | CC0 1.0 Public Domain. Commercial use permitted. Attribution: "Housing Price Dataset of Delhi, Kaggle (CC0)". Only source in the accepted set that carries coordinates, which is why it anchors the geospatial build. |
| Housing Prices in Metropolitan Areas of India — Delhi.csv — `kaggle_metro_prices_delhi` | Listing rows with a 38-column binary amenity matrix and locality labels | Delhi (metropolitan) | Kaggle public dataset download API | **3,858** accepted from 4,998 raw | `asking_price` | CC0 1.0 Public Domain. Commercial use permitted. Attribution: "Housing Prices in Metropolitan Areas of India, Kaggle (CC0)". Observation date not published. |
| Real Estate Data from 7 Indian Cities — `kaggle_7cities_listings` | Listing rows spanning seven cities | Bangalore, Chennai, Delhi, Hyderabad, Kolkata, Mumbai, Pune — only Delhi NCR rows are in scope | Kaggle public dataset download API | **695** accepted from 2,156 raw | `asking_price` | CC0 1.0 Public Domain. Commercial use permitted. Attribution: "Real Estate Data from 7 Indian Cities, Kaggle (CC0)". |
| Delhi NCR Real Estate Data (ODbL) — `kaggle_delhi_ncr_99acres` | Listing rows with carpet area, floor, transaction type, ownership type | Delhi, Gurugram | Kaggle public dataset download API | **1,184** accepted from 1,198 raw | `asking_price` | ODbL 1.0. Commercial use permitted, share-alike obligations apply. Attribution: "Delhi NCR Real Estate Data, Kaggle, ODbL 1.0". |
| Delhi Residential Property Listings (99acres raw) — `kaggle_delhi_99acres_listings` | Compact listing rows (name / location / price / area / bhk) | Delhi | Kaggle public dataset download API | **1,147** accepted from 1,399 raw | `asking_price` | CC0 1.0 Public Domain. Commercial use permitted. Attribution: "Delhi Residential Property Listings, Kaggle (CC0)". |
| 4000 Gurugram Real Estate Property Dataset — `kaggle_gurgaon_4000` | Listing rows with explicit sector labels, carpet and super built-up area | Gurugram, Haryana | Kaggle public dataset download API | **3,157** accepted from 3,489 raw | `asking_price` | CC0 1.0 Public Domain. Commercial use permitted. Attribution: "4000 Gurugram Real Estate Property Dataset, Kaggle (CC0)". |
| Gurgaon Real Estate Dataset (2023) — `kaggle_gurgaon_99acres_2023` | Listing rows split by publisher into flats / houses / land | Gurugram, Haryana | Kaggle public dataset download API, gated behind `ESTOVIA_ALLOW_NONCOMMERCIAL_SOURCES` | **5,596** accepted from 6,178 raw (2,979 flats + 958 houses + 2,241 land) | `asking_price` | **CC BY-NC-SA 4.0 — NON-COMMERCIAL.** The publisher README forbids redistribution and commercial use. Ingested for research/evaluation only, and excluded from the registered model: `artifacts/registry.json` records `non_commercial_sources_included: false`. Attribution if ever displayed: "Gurgaon Real Estate Dataset (2023), CampusX DSMP 2023, CC BY-NC-SA 4.0". |
| OpenStreetMap via Overpass API — `osm_overpass` | Geospatial POIs (metro, rail, bus stop, hospital/clinic, school/college/university, park, mall/retail, market, airport, motorway/trunk/primary) | Delhi NCR tiles fetched on demand, 0.06° tiles (~6.6 km × 7.3 km) | Overpass QL over HTTPS against `overpass-api.de`, with `overpass.kumi.systems` and `overpass.private.coffee` as fallbacks; responses cached to disk; back off on HTTP 406/429/503 | **0 observations enriched.** 5 tiles (87,376 bytes) are cached under `data/osm_cache/tiles`, but **no row in `data/processed/observations.jsonl` carries OSM features** and `evaluation_builtup.json → segment_metrics.by_geo_data_available` contains only `no_osm` (n = 1,418). The registered model was therefore trained without accessibility features. | `geospatial_derived` | ODbL 1.0. Commercial use permitted. Required attribution, carried in every feature set: "© OpenStreetMap contributors, ODbL 1.0". Retrieval rate is bounded by the public endpoint's usage policy. |

### Ingestion totals (from `data/processed/ingestion_log.json`)

- Raw records read: **27,156**
- Accepted: **23,233**
- Rejected: **3,923** — `duplicate_fingerprint` 2,019, `price_below_floor` 1,440, `duplicate_source_id` 223, `area_below_floor` 144, `near_duplicate_spatial` 88, `area_above_ceiling` 9
- By segment: `builtup` 21,240, `land` 1,993
- By category: `apartment` 17,230, `independent_house` 3,989, `land_residential` 1,993, `villa` 21
- By city: Gurugram 10,807, New Delhi 7,380, Ghaziabad 2,238, Noida 1,390, Greater Noida 881, Faridabad 537
- Rows carrying coordinates: 7,596. Rows carrying an observed date: 5,596 (all from the non-commercial Gurugram 2023 source).

One honest note about that log: `report.by_source` records **5,596** accepted rows for
`kaggle_gurgaon_99acres_2023`, but the three per-source entries in `report.sources`
(`...:flats`, `...:houses`, `...:land`) each report `records_accepted: 0`. The
adapter stamps every record with the unsuffixed `source_key`, while the per-source
log is written under the suffixed key, so the two lookups do not line up. The
5,596 figure is the one that reconciles with `by_source` and with the totals.

### Unit conversion provenance

`estovia_ml/units.py` refuses to guess: a bare `bigha` only resolves when the
state maps to a region with a cited factor, and `UnknownUnitError` is raised
otherwise. Factors are keyed by region, each with a `source` string.

| Unit | sqft | Region | Source string in `units.py` |
| --- | --- | --- | --- |
| sqft | 1.0 | all | canonical unit |
| sqm | 10.7639104167097 | all | SI definition: 1 m = 3.280839895 ft |
| sqyd | 9.0 | all | international yard = 3 ft |
| acre | 43560.0 | all | international acre = 43,560 ft2 |
| hectare | 107639.104167097 | all | 1 ha = 10,000 m2 |
| sqkm | 10763910.4167097 | all | SI definition |
| bigha_hr | 27225.0 | haryana | Haryana revenue convention: 1 bigha (bisi) = 27,225 sq ft = 2,529.29 m2 |
| kantha_hr | 5445.0 | haryana | Haryana: 1 kana = 1/5 bigha = 5,445 sq ft |
| biswa_hr | 2722.5 | haryana | Haryana: 1 biswa = 1/10 bigha = 2,722.5 sq ft |
| bigha_up | 27000.0 | uttar_pradesh | UP revenue convention: 1 bigha = 27,000 sq ft = 2,509.63 m2 |
| biswa_up | 2700.0 | uttar_pradesh | UP: 1 biswa = 1/10 bigha = 2,700 sq ft |
| guntha | 1089.0 | maharashtra | Maharashtra: 1 guntha = 1,089 sq ft = 108.9 m2 |
| marla | 225.0 | north_india | 1 marla = 272.25 m2 / 225 sq ft (approx. standard) |

## Sources investigated but NOT used

Nothing below was scraped. **No CAPTCHA was bypassed and no authentication or
anti-bot control was circumvented.** For every one of these we could not verify
a public API, so using it would require either a provider-issued API key under
a written data-licensing agreement, or written permission from the publisher.

### Official state registration portals — would give `registered_transaction`

| Portal | What we found | Records obtained |
| --- | --- | --- |
| Delhi Revenue / ILR (Sub-Registrar) | `dlilr.delhi.gov.in` did not resolve (NXDOMAIN). `revenue.delhi.gov.in` loads and publishes circle-rate notifications as PDF notices with a captcha-gated per-property search. No machine-readable feed verified. | 0 (not obtained in this environment) |
| Haryana WEB-HALRIS / IGLR / Jamabandi | `jamabandi.nic.in` is intermittently reachable. Its "Integrated property wise transaction details" is real registered-sale data and appears queryable without login, but it is a per-property interactive captcha search, not a bulk feed — unusable for automated ingestion. | 0 (not obtained in this environment) |
| Uttar Pradesh IGRS | `igrsup.gov.in` landing page reachable; per-deed search is captcha/manual. No public API verified. | 0 (not obtained in this environment) |

### Commercial listing providers — would give `asking_price`

| Provider | What we found | Records obtained |
| --- | --- | --- |
| 99acres | Returns HTTP 403 to non-browser clients. No public API documentation and no feed download found. We make **no claim** about any data product 99acres may or may not offer. | 0 (not obtained in this environment) |
| MagicBricks | Root reachable; no documented API and no third-party data-licensing product found. Scraping is prohibited by their terms and by our policy. We make **no claim** about any data product MagicBricks may or may not offer. | 0 (not obtained in this environment) |
| Housing.com | Returns HTTP 406 to non-browser clients; no public API documentation found. We make **no claim** about any data product Housing.com may or may not offer. | 0 (not obtained in this environment) |
| Square Yards | Investigated and not usable. No public API was verified, nothing was scraped, no CAPTCHA or authentication control was bypassed, and we make **no claim** about any API it may or may not offer. Use would require a provider API key plus written permission. | 0 (not obtained in this environment) |

### Other sources investigated and rejected

Recorded in `estovia_ml/sources.py` with the reason attached. All yielded
**0 (not obtained in this environment)**:

| Source | Reason recorded in code |
| --- | --- |
| Open Government Data Platform India (`api.data.gov.in`) | Unreachable without a self-registered key: HTTP 400 "Authorization field missing", intermittent HTTP 503, HTTP 403 "Key not authorised" for the widely published demo key. `www.data.gov.in` renders "No records found" plus a maintenance banner. |
| Gujarat OGD property sale transactions | NXDOMAIN from two independent resolvers; no API could be verified. |
| Maharashtra Bhulekh / IGRS | NXDOMAIN (likely geo-fenced DNS rather than removal). |
| Telangana TS-bhoomi | NXDOMAIN. |
| Nominatim geocoding | Reachable, but the usage policy forbids systematic/bulk querying; Estovia uses coordinates already stored on its own listings instead. Not a data source. |
| OpenRouteService | Reachable but `/v2/directions` returns HTTP 401 without a key. Adapter left in place, unused, for travel-time features only if `ESTOVIA_OPENROUTESERVICE_KEY` is supplied. |
| NHB Housing Price Index | Reachable and free to view, but publishes a quarterly **city-level index**, not per-property values. Cannot support a property-level target. |
| India Real Estate Intelligence Dataset 2025-2026 | Synthetic. Downloaded and inspected: developer names follow the pattern "Urban Builders &lt;n&gt;", `buyer_type` includes "Trust", `bank_name` = "Mixed", registration numbers are sequential `REG<digits>`, cities named "Bihar City 125" / "Lakshadweep". |
| House Price dataset of India | Mislabelled. File headers are Ames/Iowa Housing; lat/lon 52.88/-114.47 (Edmonton, Alberta); price in USD. Not Indian data. |
| House Prices India | Mislabelled. Same Ames/Iowa content. |
| Delhi NCR Housing Dataset (2025) | Synthetic. `area_sqft` is the constant 1400 and `bhk` the constant 3 across all 12,000 rows in both raw and cleaned files. |
| Indian Real Estate Market Dataset 2023-25 | Synthetic / no provenance. A single file named `indian_realestate_dataset_1000.csv` with exactly 1,000 rows and no publisher provenance. |

## Target semantics

**The model predicts ADVERTISED ASKING PRICES. It does not estimate registered
sale prices.**

- Target variable: `log_price_per_sqft`, described in the artifacts as
  "advertised asking price per square foot (log scale)".
- Every accepted source in the table above is an `asking_price` source. Asking
  price is what a seller or agent *lists*, which routinely differs from the price
  a buyer actually pays, and the size of that gap is unknown to us.
- No registered-transaction dataset was obtainable in this environment, so the
  engine does **not** estimate registered sale prices, does not compare against
  registered rates, and must never be described as doing so. The same sentence
  is carried in `artifacts/registry.json` (`target_semantics`), in every model
  artifact, and in the runtime export consumed by the Next.js layer, so the
  caveat travels with the numbers instead of living only in prose.
- A `registered_transaction` target would be a different model over a different
  target, and would require access we do not have.

## Circle rates

**No circle-rate schedule has been ingested.** There is no circle-rate data in
this repository, none in `artifacts/`, and none in the observation set. The
Delhi Revenue portal publishes circle-rate notices as captcha-gated PDF
notices and no machine-readable feed was verified.

Circle rates are not a substitute for transaction prices, and this repository
does not treat them as one:

- A circle rate is a **statutory minimum / guidance value** published per
  jurisdiction, per category, per land use, and per band. It is a floor used for
  stamp duty and registration valuation — not an observation of what a property
  sold for.
- Because it is a floor, a circle rate **systematically understates market value**
  in a functioning market and is revised administratively rather than observed.
  Substituting it for a sale price would bias every estimate downward and would
  not become more accurate by being called a "reference value".
- It is a **different target type** (`circle_rate / guidance_value`), not a
  substitute for `asking_price`, and mixing the two in one training set would
  corrupt the target definition.

If a circle-rate schedule is ever ingested, the following rules apply and are
not negotiable:

1. Store, per record: **jurisdiction**, **category**, **land use**, **rate**,
   **unit** (using the region-keyed factors in `estovia_ml/units.py`),
   **effective date**, and **source** (with the publisher URL and licence).
2. Carry `effective_date` and treat superseded schedules as history, never as
   current.
3. Display circle rates **separately** from model estimates, labelled as a
   statutory guidance value — never blended into a predicted price, never shown
   as the model's output, and never used to override the model.
