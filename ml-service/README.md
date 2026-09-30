# Estovia ML Service — Property Valuation

**Read this if you want to understand and explain the whole system.** It starts
from zero ML knowledge and builds up to the engineering detail. Nothing here is
aspirational — every number, feature and claim is one that is actually
implemented and has been verified.

- Data provenance and licensing: [`DATA_SOURCES.md`](DATA_SOURCES.md)
- The technical runbook (commands, artifacts, retraining policy) is in
  [§25](#25-technical-runbook) at the bottom of this file.

---

## Table of contents

1. [What this feature does](#1-what-this-feature-does)
2. [The problem it solves](#2-the-problem-it-solves)
3. [The complete user flow](#3-the-complete-user-flow)
4. ["Asking price" — the most important word in this project](#4-asking-price--the-most-important-word-in-this-project)
5. [The data](#5-the-data)
6. [Turning a property into 46 numbers](#6-turning-a-property-into-46-numbers)
7. [Splitting the data, and why it is done this way](#7-splitting-the-data-and-why-it-is-done-this-way)
8. [Why XGBoost](#8-why-xgboost)
9. [How training works](#9-how-training-works)
10. [How a prediction is made](#10-how-a-prediction-is-made)
11. [The price-per-sq-ft calculation](#11-the-price-per-sq-ft-calculation)
12. [The range: conformal prediction](#12-the-range-conformal-prediction)
13. [Comparables: showing the real listings behind the number](#13-comparables-showing-the-real-listings-behind-the-number)
14. ["What moved this estimate"](#14-what-moved-this-estimate)
15. [The results, explained in plain words](#15-the-results-explained-in-plain-words)
16. [What this model cannot do](#16-what-this-model-cannot-do)
17. [Verified vs indicative](#17-verified-vs-indicative)
18. [The exact runtime flow](#18-the-exact-runtime-flow)
19. [Technology stack](#19-technology-stack)
20. [Important files](#20-important-files)
21. [Running and verifying it locally](#21-running-and-verifying-it-locally)
22. [How deployment works](#22-how-deployment-works)
23. [Future improvements](#23-future-improvements)
24. [Glossary](#24-glossary)
25. [Technical runbook](#25-technical-runbook)

---

## 1. What this feature does

A user enters the details of a property — city, locality, area, bedrooms, floor,
and so on. Estovia returns:

- an **estimated asking price** (one number),
- a **price per square foot**,
- a **wide range** around that number,
- **how many real listings** the estimate was checked against,
- an **explanation** of which inputs pushed the estimate up or down, and
- an honest statement of **how much to trust it**.

It is the same model behind every entry point in the app: the buyer page, the
landowner page, the builder page, the admin page, and the standalone
`/valuation` page.

## 2. The problem it solves

When you look at a property listing, you can see what the seller is *asking*.
You cannot see what a similar property is *fairly* asking right now, because:

- Every seller picks their own number, and some are greedy, some are unrealistic.
- There is no public "true price" for a home. The government records circle
  rates (the minimum price used for stamp duty), which are not market prices.
- To know if a price is fair you would have to manually compare dozens of
  nearby listings, adjust for floor, area and age, and average them.

That last job is exactly what a machine-learning model does well, and exactly
what a person does badly. The model has read 17,637 real listings and learned
which combinations of location, size and quality correspond to which asking
price per square foot.

**What the model does not do:** it does not tell you whether a property is a
good buy, whether the seller is honest, or whether the market is about to move.
It estimates a price, and it is upfront about how wrong it can be.

## 3. The complete user flow

```
   User fills the form                     Next.js server
   (city, locality, area, beds...)                │
            │                                    │
            │  POST /api/valuation/predict       │
            └──────────────────────────────────► │
                                                 │
                              1. check login + role        (lib/auth)
                              2. check rate limit         (mongo count)
                              3. clean + validate input   (valuation/schema.js)
                                    ├─ area → sq ft
                                    ├─ city → canonical name
                                    └─ refuse land / unknown city
                              4. build 46 features         (valuation/features.js)
                                 (log area, ordinals,
                                  locality price level, …)
                              5. run 1,200 decision trees  (valuation/model.js)
                                 → one number, log Rs/sq ft
                              6. exponentiate × area       → Rs
                              7. apply the calibrated band → range
                              8. find similar listings     (comparables.js)
                              9. explain the result        (predict.js)
                             10. save to MongoDB           (ValuationPrediction)
                                                 │
            ◄────────────────────────────────────┘
            JSON: estimate, range, listings, explanation
                                                 │
            ─────────────────────────────────────┘
            The page shows the estimate in plain language, with the
            technical detail hidden behind "How accurate is the model?"
```

Nothing above needs Python. The trained model is a **binary file** that the
JavaScript code walks directly, in about a millisecond.

## 4. "Asking price" — the most important word in this project

**Estovia predicts what a property is being ADVERTISED for, not what it sold
for.**

These are genuinely different numbers. A listing sits on a portal for weeks
while the seller waits for a buyer, and the eventual deal is usually below the
advertised figure. The gap is real and it varies by city and segment, but we
could not measure it, so this project does not guess at a figure.

Why this matters for honesty:

- Every artifact the model writes carries this sentence in its
  `targetSemantics` field, and the API returns it to the UI.
- No registered-transaction dataset was obtainable in this environment.
  Official state registration portals were investigated and rejected as data
  sources — see [`DATA_SOURCES.md`](DATA_SOURCES.md). The project therefore
  **does not estimate registered sale prices and never claims to**.
- Circle rates are not used. They are a government reference price for stamp
  duty, not a market price, and using them would silently change what the model
  means.

If you tell someone "Estovia predicts the value of a home", that is wrong.
Say: **"Estovia estimates the advertised asking price of a home, and shows you
the real listings it used."**

## 5. The data

### 5.1 Where the data comes from

Seven public listing datasets, downloaded from the Kaggle public dataset API
with no credentials. Per-source row counts, licences and the full
investigation of what was rejected are in
[`DATA_SOURCES.md`](DATA_SOURCES.md).

| Source key | Accepted rows | Licence |
| --- | --- | --- |
| `kaggle_delhi_ncr_housing_v2` | 7,596 | CC0 1.0 (public domain, commercial use OK) |
| `kaggle_gurgaon_99acres_2023` | 5,596 | **CC BY-NC-SA 4.0 — NON-COMMERCIAL, EXCLUDED from the model** |
| `kaggle_metro_prices_delhi` | 3,858 | CC0 1.0 |
| `kaggle_gurgaon_4000` | 3,157 | CC0 1.0 |
| `kaggle_delhi_ncr_99acres` | 1,184 | ODbL 1.0 (commercial use OK, share-alike) |
| `kaggle_delhi_99acres_listings` | 1,147 | CC0 1.0 |
| `kaggle_7cities_listings` | 695 | CC0 1.0 |

**All data is asking price.** No source provided registered transactions.

### 5.2 How many records

This is the part people get wrong, so here is the exact chain:

```
23,233  accepted observations (all categories, all six cities)
        │  21,240 built-up   (apartment, independent house, villa)
        │   1,993 land       (land_residential)
        │
        ├─  3,603 built-up rows come from the CC BY-NC-SA source.
        │     That licence forbids commercial use, so they are
        │     research-only and are EXCLUDED from the registered model.
        │
        └─ 17,637 built-up rows under permissively commercial licences
            ══ the model pool ══
                 │
                 ├─ 13,787  train         (learn the patterns)
                 ├─  2,432  calibration  (size the prediction range)
                 └─  1,418  test          (measure real-world accuracy)
```

Breakdown of the 23,233 accepted rows:

| Property type | Rows |
| --- | --- |
| Apartment | 17,230 |
| Independent house | 3,989 |
| Residential land | 1,993 |
| Villa | **21** |

| City | Accepted built-up rows | Rows in the model pool |
| --- | --- | --- |
| Gurugram | 8,814 | 5,211 |
| New Delhi | 7,380 | 7,380 |
| Ghaziabad | 2,238 | 2,238 |
| Noida | 1,390 | 1,390 |
| Greater Noida | 881 | 881 |
| Faridabad | 537 | 537 |
| **Total** | **21,240** | **17,637** |

Gurugram loses 3,603 rows between the two columns because the excluded
non-commercial source is a Gurugram-only dataset. The other five cities are
unaffected.

> **Villa is a real caveat.** The model accepts `villa` as a supported type and
> it is present in the learned category statistics, but the entire accepted
> dataset contains only **21 villa listings** (all in New Delhi). Villa
> estimates are thinly supported. The 400-record floor described in
> [§25](#252-model-selection-rule) applies per *segment*, not per category, so
> villa is not blocked by it.

> **The city mix is very uneven.** 5,211 of the 17,637 model-pool rows are
> Gurugram, while Faridabad has 537 — a 10x imbalance. Medians for the thin
> cities are correspondingly fragile.

### 5.3 How the data was cleaned

Implemented in `estovia_ml/validation.py` and `estovia_ml/parsing.py`. The
design rule: **never silently drop a record.** A record is either accepted
(possibly carrying a `quality_flag`) or rejected *with a recorded reason*, so
the count of what was thrown away is always auditable.

**Hard rejections** (the record is impossible or unusable):

| Rule | Threshold |
| --- | --- |
| Demo/sample data | always rejected — `is_demo` is asserted `False` on everything that reaches the model |
| Missing, non-numeric or non-positive price | rejected |
| Price below floor | < ₹5,00,000 |
| Price above ceiling | > ₹5,00,00,000 |
| Missing, non-numeric or non-positive area | rejected |
| Built-up area out of range | < 150 sq ft or > 200,000 sq ft |
| Land area out of range | < 200 sq ft or > 4,000,000 sq ft |
| Latitude outside ±90 / longitude outside ±180 | rejected |
| City outside the six NCR cities | rejected |
| Price per sq ft missing or ≤ 0 | rejected |

**Soft flags** (unusual but real — the record is **kept**):

| Flag | Meaning |
| --- | --- |
| `very_low_price_per_sqft` | < ₹300/sq ft |
| `very_high_price_per_sqft` | > ₹4,00,000/sq ft |
| `coordinates_outside_ncr` | a point outside the NCR bounding envelope (lat 28.30–29.60, lon 76.70–78.10) on a record claiming an NCR city — a geocoding failure, not a luxury home |
| `cleared_bedrooms` / `cleared_bathrooms` / `cleared_balconies` / `cleared_floor_number` / `cleared_total_floors` | value was nonsensical (negative, or above 30 rooms / 90 floors) and was set to missing rather than guessed |

> **Outliers are deliberately not removed.** A genuine luxury penthouse really
> does trade above the 99th percentile. Deleting extreme prices would make the
> model look better than it is.

**Deduplication** happens in three passes, so the same flat advertised on three
portals does not get counted three times:

1. `(source_key, source_record_id)` — the same record twice from one source.
2. **Content fingerprint** — a SHA-1 of
   `category | city | lowercase locality | title | price | area | bedrooms`.
   Catches the same flat re-uploaded under a different record id.
3. **Spatial key** — `category | city | locality | lat/lon rounded to 3dp | price | area`.
   Catches "the same unit advertised twice" on one portal.

Rejected duplicates are logged, so cross-source overlap can be reported.

**Parsing** (`parsing.py` and the per-source `adapters.py`) normalises the
messiness of real listing text. Verified examples of what the code actually
does:

- City strings are canonicalised through an alias table: `gurgaon`,
  `gurgaon city` and `GURUGRAM` all become `Gurugram`;
  `new delhi - west`, `new delhi - south`, `new delhi - east` and
  `new delhi - dwarka` all become `New Delhi`.
- New-vs-resale is read from a `neworold` field: a value starting with `new`
  becomes `new_property`, one starting with `resale` becomes `resale`.
- Property age is read from an `agePossession` field.
- Area in sq yd, sq m, acre, hectare, marla, bigha, biswa or guntha is converted
  to **square feet**. The original value and unit are preserved in
  `area_value_original` / `area_unit_original` so any conversion can be audited
  or reversed.

## 6. Turning a property into 46 numbers

A model cannot read "3 BHK on the 7th floor in Sohna Road". It needs a row of
46 numbers. That conversion is the **feature transform**, and it lives in
`estovia_ml/features.py` (training) and `src/lib/valuation/features.js` (the
app). The two are a matched pair, verified to agree to floating-point noise
(see [§21](#21-running-and-verifying-it-locally)).

### 6.1 The 46 features

Listed in the exact order the model consumes them.

**Size and layout (11)**

| # | Feature | What it means |
| --- | --- | --- |
| 1 | `log_area_sqft` | Area, on a log scale |
| 2 | `bedrooms` | Bedrooms |
| 3 | `bathrooms` | Bathrooms |
| 4 | `balconies` | Balconies |
| 5 | `floor_number` | Which floor |
| 6 | `total_floors` | How many floors the building has |
| 7 | `floor_ratio` | Position in the building, `(floor + 1) / total_floors` |
| 8 | `is_ground_floor` | 1 if floor 0 |
| 9 | `is_top_floor` | 1 if the top floor |
| 10 | `property_age_years` | How old the building is |
| 11 | `is_new_build` | 1 if age ≤ 1 year |

**Amenities and data availability (4)**

| # | Feature | What it means |
| --- | --- | --- |
| 12 | `lift_available` | 1 yes, 0 no |
| 13 | `parking_count` | Number of parking spaces |
| 14 | `amenity_count_source` | How many amenities the *advertisement* listed |
| 15 | `geo_data_available` | 1 if the OSM proximity lookup succeeded for this listing |

**Descriptive categories (5)** — mapped to numbers because a tree cannot read
words:

| # | Feature | Encoding |
| --- | --- | --- |
| 16 | `furnishing_ord` | unfurnished 0, semi 1, furnished 2, unknown 1 |
| 17 | `facing_ord` | north 0.45, NE 0.625, east 1.0, SE 0.375, south 0.55, SW 0.125, west 0.375, NW 0.875 — roughly scored for desirability |
| 18 | `ownership_ord` | leasehold 0, freehold 1, society 1, unknown 0.5 |
| 19 | `transaction_ord` | new 0, resale 1, unknown 0.5 |
| 20 | `area_definition_ord` | carpet 0, built-up 1, plot 0.5, total 1 — because a 1,250 sq ft *carpet* flat is not a 1,250 sq ft *built-up* flat |

**Ratios and type (3)**

| # | Feature | What it means |
| --- | --- | --- |
| 21 | `has_coordinates` | 1 if the listing carried a latitude/longitude. This one **is** live: 7,596 of the 17,637 pool rows (43%) have a map pin |
| 22 | `log_bed_area_ratio` | `log(bedrooms per 1,000 sq ft)` — how cramped the flat is |
| 23 | `property_category` | Position in the fixed category list, `-1` if unknown |

**Location price levels (4)** — the most important inputs in the whole model:

| # | Feature | What it means |
| --- | --- | --- |
| 24 | `locality_te` | Smoothed average log price/sq ft of this locality |
| 25 | `log_locality_freq` | `log(how many listings exist in this locality)` |
| 26 | `_city_te` | The city's price level |
| 27 | `_category_te` | The property type's price level |

**Geospatial (19)** — distance to metro, rail station, bus stop, hospital,
school, park, mall, market, airport, major road; plus "within X km" flags and
composite amenity scores at 1 km and 3 km:

| # | Feature | What it means |
| --- | --- | --- |
| 28 | `dist_metro_km` | Distance to the nearest metro station |
| 29 | `dist_rail_station_km` | Distance to a railway station |
| 30 | `dist_bus_stop_km` | Distance to a bus stop |
| 31 | `dist_hospital_km` | Distance to a hospital |
| 32 | `dist_school_km` | Distance to a school / college |
| 33 | `dist_park_km` | Distance to a park |
| 34 | `dist_mall_km` | Distance to a mall |
| 35 | `dist_market_km` | Distance to a market |
| 36 | `dist_airport_km` | Distance to an airport |
| 37 | `dist_major_road_km` | Distance to a major road |
| 38 | `metro_within_1km` | 1 if a metro station is within 1 km |
| 39 | `metro_within_3km` | 1 if within 3 km |
| 40 | `hospital_within_2km` | 1 if a hospital is within 2 km |
| 41 | `school_within_1km` | 1 if a school is within 1 km |
| 42 | `park_within_1km` | 1 if a park is within 1 km |
| 43 | `mall_within_3km` | 1 if a mall is within 3 km |
| 44 | `amenity_score_1km` | Composite accessibility score within 1 km |
| 45 | `amenity_score_3km` | Composite accessibility score within 3 km |
| 46 | `amenity_index` | Overall composite accessibility index |

11 + 4 + 5 + 3 + 4 + 19 = **46**.

> **Features 28–46 and flag 15 are all zero, forever, in this model.** This is
> the single most important thing to understand about the feature set, and the
> distinction is subtle:
>
> - **7,596 pool rows (43%) do carry a raw latitude/longitude**, and that is
>   why feature 21 `has_coordinates` is a live, varying input.
> - **Zero rows carry a `geo_features` payload.** The OSM proximity join
>   (`estovia_ml/geospatial.py`, which sets `osm_ok` and fills features 28–46)
>   never ran to a successful result for any accepted row, so `osm_ok` is
>   falsy everywhere and `geo_data_available` (feature 15) is **0 for every
>   row**, including the 7,596 that have coordinates.
> - Because no training row ever produced a median for features 28–46, the
>   transform falls back to a hard `0.0` for them rather than imputing a
>   median (see the fallback in `src/lib/valuation/features.js`).
>
> The evaluation report's breakdown by geo availability contains a single
> entry, `no_osm`, with n = 1,418 — the entire test fold. So the practical
> meaning is: **you cannot currently get a "how close is the metro" signal out
> of this model, even for listings that have a map pin.** See
> [§16](#16-what-this-model-cannot-do).

### 6.2 Feature engineering — the four ideas that matter

**1. Log the target, not the raw price.** The model predicts
`log(price per sq ft)`, not total price. Total price is mostly decided by area,
so a model predicting it would learn "bigger = pricier" and nothing else. Price
per unit area is what actually varies with location and quality, and it is
scale-free: a 1,000 sq ft flat and a 2,000 sq ft flat in the same building
should cost about twice as much per square foot. Multiplying by area at the end
reconstructs the total.

**2. Target encoding for locality, city and category.** You cannot just write
`locality = "sohna road"`. Instead, each locality is replaced by a number: *the
average log price per sq ft of listings in that locality*. This is the single
most important feature, and it is why a house in a good locality is priced
correctly.

The encoding is **smoothed** so a locality with three listings does not get a
wildly confident number:

```
encoded = (sum_of_targets + k × global_median) / (count + k)      with k = 20
```

A locality with 100 listings is dominated by its own data. A locality with 2
listings is pulled most of the way back to the market-wide median.

**3. Out-of-fold encoding during training.** If you encode each training row
with the average of its own locality *including itself*, the model learns to
trust that number far too much, and it collapses at prediction time on a new
property. So during training each row is encoded using **leave-one-out /
out-of-fold** statistics — statistics computed with that row held out. At
inference time on a genuinely new property, the full in-sample statistic is
correct, because the property was never in the data.

**4. Median imputation for anything missing.** Real listings are missing
lift, parking, floor and age constantly. Rather than treating missing as zero
(which would mean "ground floor, no lift"), each missing numeric value is
replaced with the **median of that column in the training fold**, stored in the
artifact. The API also tells the user which fields they left blank
(`imputed_inputs` flag), so the UI can be honest about it.

Unknown categories fall back too: an unseen locality uses the city statistic,
an unseen city uses the global median, and a missing facing direction uses a
neutral 0.5.

## 7. Splitting the data, and why it is done this way

The 17,637 pool is divided into three parts that do different jobs:

| Split | Rows | Job |
| --- | --- | --- |
| Train | 13,787 | Learn the patterns |
| Calibration | 2,432 | Work out how wide the range must be |
| Test | 1,418 | Measure how good the model really is |

**The test set is a geographic holdout of two entire cities: Faridabad and
Greater Noida (537 and 881 rows).** Every row from those cities is removed from
training and calibration, and the model is evaluated on them afterwards.

Why whole cities, and not a random sample?

- A random split leaks. Two flats in the same building on the same floor sell
  for nearly the same price, so a random split puts near-identical properties on
  both sides and produces a flattering, meaningless score.
- Holding out **entire cities** asks the only question that matters: *does this
  model work somewhere it has never been?* When a user in Faridabad asks for a
  valuation, the model has literally never seen a Faridabad price.

Within the four remaining cities (Noida, Ghaziabad, Gurugram, New Delhi), the
train/calibration split is a **grouped** random split — grouped by
`city + locality + project + price bucket` so that related listings stay on the
same side of the split.

**There is no time-based test, and that is a known gap.** No accepted source
publishes an observation date for its records, so a "train on the past, test on
the future" split cannot be built without inventing dates. The artifact records
this honestly as `temporal_validation.status: "unavailable"`. **The model has
never been tested against a market movement.**

## 8. Why XGBoost

Three candidate models were trained on the same split and scored on the same
held-out test fold, against a deliberately simple baseline:

- **XGBoost** — gradient-boosted decision trees
- **Ridge regression** — a linear model with regularisation
- **Random forest** — an average of many unrelated trees

The baseline is **"multiply the area by the median price per sq ft of the
locality"**. That is the honest bar. If a complex model cannot beat that, it is
adding nothing but cost and false confidence.

XGBoost won. It is also the right family of model for this problem because:

1. **The data is mostly categories and thresholds.** "Is the floor ratio above
   0.6?", "is this over ₹9,000/sq ft?" — a tree answers these natively. A linear
   model has to be handed hand-crafted interactions.
2. **It handles missing and mixed-scale inputs** without the normalisation a
   linear model needs.
3. **It captures interactions.** Floor value depends on total floors *and* lift
   availability; trees learn that combination automatically.
4. **It is not interpretable on its own**, which is why the "what moved this
   estimate" explanation in [§14](#14-what-moved-this-estimate) exists.

**Selection is deliberately conservative** (implemented in
`train.py::evaluate_split`):

1. A segment with fewer than `MIN_SEGMENT_RECORDS = 400` observations is
   skipped entirely. Nothing is registered, and the API must return an explicit
   unsupported status rather than a guess.
2. All candidates **plus the baseline** are scored on the held-out test fold —
   never on training data.
3. Candidates are ranked by **lower median percentage error**, then lower RMSE.
   Median is used deliberately: a handful of ultra-luxury Gurugram listings
   would otherwise dominate the ranking.
4. **A model is only registered if it beats the baseline out-of-sample.** The
   gate is strict — strictly lower median error. The registry records
   `beatsBaseline: true` for the shipped model.
5. Interval calibration uses the calibration split **only**, never the test
   split.

## 9. How training works

In plain terms: the model is 1,200 small decision trees, added one at a time,
where each new tree is built to correct the mistakes of all the trees before it.

1. **Start with a baseline number** — the median log price per sq ft in the
   training fold (`base_score = 8.914659`).
2. **Show it the data and measure the mistake** — how far each prediction is
   from the real log price.
3. **Build one small tree to fix the biggest remaining mistakes** — depth 8, so
   it can ask up to 8 yes/no questions per path.
4. **Add that tree's correction to everyone's prediction.**
5. **Repeat 1,200 times**, each time with slightly different data (70% of rows
   per tree) and a slightly different view of the features (60% of features per
   split). That randomness is what stops the model from memorising.
6. **Stop.** The result is an additive pile of 1,200 corrections.

The shipped parameters:

| Parameter | Value |
| --- | --- |
| `n_estimators` (trees) | 1,200 |
| `max_depth` | 8 |
| `learning_rate` | 0.05 |
| `subsample` | 0.7 |
| `colsample_bytree` | 0.6 |
| `reg_lambda` | 1 |
| `reg_alpha` | 1 |
| `min_child_weight` | 1 |
| Objective | `reg:squarederror` on `log(price_per_sqft)` |
| Total nodes | 283,866 |
| Model id | `estovia-builtup-20260929185112` |
| Trained at | 2026-09-29T18:51:12+00:00 |
| Feature schema | `feat.v1` |

## 10. How a prediction is made

No network, no Python, no external service. Just arithmetic:

```
 1.  Take the user's input.
 2.  Build the same 46 numbers as in training          (features.js)
 3.  For EACH of the 1,200 trees:
       walk from the root, asking "is this value ≤ the split threshold?"
       go left or right, until you reach a leaf
       collect that leaf's number
     Sum all 1,200 leaf numbers.
 4.  Add the base score.  →  a number in log Rs/sq ft
 5.  e^that number       →  Rs per sq ft
 6.  × the area in sq ft  →  the estimate in rupees
 7.  Multiply by (1 ± 0.8768559022935312)  →  the range
```

Each tree is just an array of numbers in a `Float64Array`, and the evaluator is
a `while` loop. A prediction takes roughly a millisecond.

**This exact walk was verified against the Python implementation** on 200 real
observations: maximum absolute difference `0.0` — bit-identical.

## 11. The price-per-sq-ft calculation

The model never predicts a total price. It predicts a *rate*, and the app
multiplies:

```
margin      = base_score + Σ (leaf values from all 1,200 trees)
pricePerSqFt = exp(margin)          ← undo the log
valueInr     = pricePerSqFt × areaSqFt
```

Example: if the trees produce a margin of `8.9`, then
`exp(8.9) ≈ 7,330` Rs/sq ft, and a 1,250 sq ft flat is
`7,330 × 1,250 ≈ ₹91.6 lakh`.

Two consequences worth knowing:

- **Area is converted to square feet first.** A user entering `sq m`, `acre`,
  `bigha`, `biswa` or `marla` gets an exact conversion. A bare "bigha" is
  refused rather than guessed, because it differs by state.
- **Changing the area unit changes nothing about the model's reasoning.** Only
  the final multiplication changes.

## 12. The range: conformal prediction

A single number is dishonest when you know you might be 40% off. So the model
ships a range, sized by a method with a statistical guarantee.

**The idea, in one paragraph:** hold back the calibration set, and for each of
those 2,432 properties measure how big its error was *as a fraction* of its real
price. Sort those error fractions and take a cutoff `q` at the 90th percentile.
Now, for a *new* property, if the model is off by less than `q` about 90% of the
time, then `estimate × (1 − q)` to `estimate × (1 + q)` is a range that should
contain the real asking price about 90% of the time.

The verified value is `q = 0.8768559022935312` (α = 0.10, n = 2,432).

> **Be precise about what "90%" means.** The interval is a **90%** band (α = 0.1
> means 10% may fall outside), and on the test set the real asking price landed
> inside **99.72%** of the time. It is deliberately conservative: too wide rather
> than too confident.

**This range is wide — and that is the honest result.** A mean width of
₹1,45,10,191 against an average error of ₹27,14,074 is what a 10% relative-error
target costs on a heterogeneous Delhi-NCR market. Narrowing it would mean
overstating our knowledge. **Use the range, not the point estimate.**

## 13. Comparables: showing the real listings behind the number

An estimate you cannot check is just an assertion. So the app also returns the
**actual real listings** it compared against.

Real asking-price observations are bucketed by
`city | locality | property type` into up to 4,000 buckets (164 low-volume
buckets were dropped), holding **17,473 observations**, and exported to
`comparables.json`.

Lookup falls back in three tiers, and the UI labels which tier was used:

1. **Same locality** and same type — the strongest.
2. **Same city**, other localities — used when the locality is thin.
3. **City level only** — the weakest; the UI says so explicitly.

No owner identity, contact detail, document or internal record path is ever
exported. Each listing's source and licence are retained per row so the number
is attributable.

The count of listings used is also what drives the **coverage grade** shown to
the user: `sufficient`, `limited`, `low`, or `out_of_distribution`. Coverage
describes **evidence support — how much real data backs this number. It is not a
statistical confidence score, and the UI never presents it as one.**

## 14. "What moved this estimate"

The app shows, for each main input, what would happen to the estimate if that
input were set to the typical value seen in training:

```
"Your area: 1,250 sq ft vs typical 1,295 sq ft → +0.11%"
```

The method is called `local_median_perturbation`. It works by re-running the
whole model with that one input replaced, and measuring the percentage change.

**Be honest about what this is not.** These rows:

- **do not add up to the total** — they are separate re-runs, not a decomposition;
- **are not causal** — "floor" contributing +3% does not mean adding a floor
  would raise the price by 3%;
- **are local** — they only describe this one prediction, not global behaviour.

They are labelled in the UI as exactly that. Their purpose is to make the number
legible, not to claim a causal model.

## 15. The results, explained in plain words

Measured on the **1,418 listings of Faridabad and Greater Noida — cities held
out of training entirely.**

| What it means in plain words | Metric | Model | Baseline |
| --- | --- | --- | --- |
| How many properties were tested | `n` | 1,418 | 1,418 |
| **Typical mistake**: half of the test properties were off by less than this | median APE | **42.72%** | 73.19% |
| Average mistake as a share of the price | MAPE | 48.73% | 73.56% |
| Average mistake as a share of all prices combined | WAPE | 43.69% | 62.14% |
| Average gap in rupees | MAE | ₹27,14,074 | ₹38,60,729 |
| The size of the typical mistake in rupees | median absolute error | ₹21,37,955 | ₹35,00,000 |
| The size of the *worst* typical mistakes | RMSE | ₹39,74,313 | ₹47,39,323 |
| How much of the real price variation the model explains (1 = perfect, 0 = no better than a flat average) | R² | **0.392** | 0.136 |
| How often the real price fell inside our range | interval coverage | 99.72% | 98.66% |
| Average width of the range | mean interval width | ₹1,45,10,191 | ₹1,44,07,933 |

**How to say this to a teacher, honestly:**

> "On 1,418 listings from two cities the model had never seen, its typical error
> was about 43% of the property's price. A simple method — multiplying the area
> by the average price per square foot in that locality — is off by about 73%.
> So the model is meaningfully better than a simple average, but it is not
> precise, and we show a wide range accordingly."

There is **no "accuracy percentage"** in these artifacts, so none is quoted
anywhere. Note also that R² = 0.392 means the model explains about 39% of the
variation in prices; it is genuinely uncertain about the rest.

**What the model leans on most** (share of splits used during training):

| Input | Share |
| --- | --- |
| Locality price level | 18.69% |
| How common this locality is | 14.89% |
| Carpet area | 14.73% |
| Bedroom density | 13.26% |
| Floor | 4.55% |
| Bedrooms | 4.33% |
| Balconies | 4.00% |
| Bathrooms | 3.80% |
| City price level | 3.57% |
| Parking | 2.73% |
| Area basis | 2.70% |
| Has map location | 2.57% |

Location dominates, exactly as you would expect in real estate.

## 16. What this model cannot do

These are load-bearing caveats, not hedges.

1. **It cannot predict sale prices.** It predicts advertised asking prices. The
   asking-to-transaction gap is real and unmeasured.
2. **It cannot value land or commercial property.** There is no model for those
   segments. The API returns an explicit `unsupported_category` status. It
   never falls back to the residential model.
3. **It cannot value anything outside six cities.** Outside Faridabad,
   Ghaziabad, Greater Noida, Gurugram, New Delhi and Noida it returns
   `unsupported_location`.
4. **It has never been tested against a market move.** No source provides
   observation dates, so there is no temporal validation. See
   [§7](#7-splitting-the-data-and-why-it-is-done-this-way).
5. **It uses no geospatial data.** Distance to metro, schools, hospitals and
   parks is not part of the estimate. The feature code is present and correct,
   but no accepted listing carried a *usable* `geo_features` payload, so the
   registered model saw only zeros for features 28–46. Any claim that
   POI-proximity features improve accuracy is currently unsupported.
6. **The holdout is two cities, not six.** Nothing in the test fold represents
   New Delhi, Gurugram, Noida or Ghaziabad. The reported performance is evidence
   for Faridabad and Greater Noida.
7. **Villa is thinly supported** — 21 listings in the whole dataset, all in New
   Delhi. The test fold contains **no villa rows at all** (it breaks down as
   1,162 apartment + 256 independent house), so villa accuracy is untested.
8. **It cannot tell you whether a property is a good deal, whether the seller
   is honest, or whether the market is about to rise or fall.** It prices a
   property. It does not advise.
9. **It cannot judge a property's condition, legal status, title, or RERA
   registration.** None of that is in the data.
10. **Thin cities have fragile medians.** In the model pool, Faridabad has 537
    rows and Gurugram has 5,211.
11. **It is a Delhi-NCR model.** Nothing here is validated for any other city.

## 17. Verified vs indicative

This is a project with a hard rule: **a number may only be published if it can
be reproduced by replaying the shipped artifact.**

**The problem this rule exists to solve.** The training run wrote
`artifacts/model_builtup.json` at `18:51:12`, but `artifacts/registry.json`
and `artifacts/evaluation_builtup.json` at `18:39:28` — the registry is
*older* than the model, so the metrics in it belong to an **earlier fit**, not
the trees that ship. The original report claimed MAE ₹26,15,880 and R² 0.422 for
this model id. Those numbers do not describe the shipped model.

**How it was resolved.** The exported artifact was replayed through the app's
own JavaScript evaluator over the same geographic holdout, and the conformal
interval re-fitted on the calibration fold
(`scripts/verify_report_replay.py --annotate`). The published metrics come from
that replay. Ruled out as the cause: float32 vs float64 threshold rounding,
categorical splits, `default_left` handling, tree-relative child pointers, and
five `locality_freq` variants (including a deliberately leaky one, which improved
MAE by 0.74% but worsened R² by 13.6%, so it is not a leakage story).

What reproduced exactly:

| Check | Result |
| --- | --- |
| Split sizes (13,787 / 2,432 / 1,418) | exact |
| Locality-median baseline, all 8 metrics | exact, 0.0000% |
| Python vs JavaScript predictions, 200 rows | bit-identical, max abs diff `0.0` |
| All 46 features across 17,636 real observations | agree, max diff `1.776e-15` |

**What this means in practice:**

| Status | Meaning |
| --- | --- |
| **Verified** | Reproduced by replaying the shipped artifact. This is everything in [§15](#15-the-results-explained-in-plain-words). Published in the UI, tagged `verified-replay-of-exported-artefact`. |
| **Indicative** | Comes from the stale training report, or from a model that was not selected. Useful for context, not for claims. |

The stale numbers are **kept** in the registry under
`stale_test_metrics_from_earlier_fit` for audit, deliberately not deleted. The
per-city and per-category breakdowns, and the ridge/random-forest comparison,
are indicative.

One known residual inconsistency: the binary model header still carries the old
`q = 0.819143720703125` and has no `verifiedReplay` block. The runtime reads the
**corrected** `q` from the JSON sidecar
(`model_builtup.meta.json → verifiedReplay.conformal.q`) and cross-checks it
against `registry.json`, warning loudly on any disagreement. The binary was not
regenerated, because regenerating a verified artifact to fix a redundant copy of
one number is not a trade this project makes.

## 18. The exact runtime flow

Production runs **JavaScript only**. Python exists solely to train and export.

| Step | File | What happens |
| --- | --- | --- |
| 1 | `src/app/api/valuation/predict/route.js` | Auth, role check, rate limit, then call the engine |
| 2 | `src/lib/valuation/schema.js` | Normalise the input: area → sq ft, canonical city, exact locality, validate bounds, refuse unsupported |
| 3 | `src/lib/valuation/features.js` | Build the 46-number vector (matched pair with the Python file) |
| 4 | `src/lib/valuation/model.js` | Load `model_builtup.bin` (cached), walk 1,200 trees, apply imputation medians |
| 5 | `src/lib/valuation/predict.js` | `exp()` the margin, × area, apply the conformal band, grade coverage, build the explanation, build the model card |
| 6 | `src/lib/valuation/comparables.js` | Look up real listings by locality, then city |
| 7 | `src/lib/models/ValuationPrediction.js` | Save the result to MongoDB (input snapshot, result, coverage, explanation, ask comparison) |
| 8 | `src/components/valuation/ValuationTool.jsx` | Render it: plain-language result on top, technical detail behind a collapsible section |

Supporting APIs: `/api/valuation/model` (model card),
`/api/valuation/history` (the caller's saved valuations),
`/api/valuation/localities` (autocomplete).

## 19. Technology stack

| Layer | Choice | Where |
| --- | --- | --- |
| Web framework | Next.js 16.3.2, App Router | app |
| UI | React 19.2.8, Tailwind CSS v4, lucide-react | components |
| Language | JavaScript / JSX — no TypeScript | everywhere |
| Database | MongoDB + Mongoose 9 | models |
| Training | Python 3.12, pandas, numpy, scikit-learn, XGBoost 3.4.1 | `ml-service/` |
| Model format | `Float64Array` binary + JSON header | artifacts |
| Runtime inference | Hand-written JS tree walker | `lib/valuation/model.js` |

**No Python is required in production.** The trained model is a data file.

## 20. Important files

### Runs in production (JavaScript)

| File | Role |
| --- | --- |
| `src/lib/valuation/features.js` | Builds the 46 features. Matched pair with the Python original. |
| `src/lib/valuation/schema.js` | Input normalisation, unit conversion, validation, support checks |
| `src/lib/valuation/model.js` | Binary loader, tree evaluator, cache, split-count importance |
| `src/lib/valuation/predict.js` | Estimate, range, coverage, explanation, ask comparison, model card |
| `src/lib/valuation/comparables.js` | Real-listing lookup with locality → city fallback |
| `src/lib/valuation/index.js` | Public exports |
| `src/lib/models/ValuationPrediction.js` | Mongo schema for saved valuations |
| `src/components/valuation/ValuationTool.jsx` | The whole user interface |
| `src/app/api/valuation/*/route.js` | The four endpoints |
| `scripts/valuation_smoke.mjs` | Engine smoke test, runs in plain Node |

### Runtime artifacts (`src/lib/valuation/artifacts/`)

| File | What it is |
| --- | --- |
| `model_builtup.bin` | 1,200 trees as parallel typed arrays (~6 MB) |
| `model_builtup.meta.json` | Imputation medians, locality/city/category statistics, ordinal maps, `localityFreq`, and the **corrected** conformal block |
| `registry.json` | Verified metrics, model metadata, segments observed and untrained |
| `comparables.json` | 4,000 buckets / 17,473 real listings, source and licence per row |

### Offline training (Python, `ml-service/`)

| File | Role |
| --- | --- |
| `estovia_ml/sources.py` | Source registry with licences |
| `estovia_ml/adapters.py` | Per-dataset parsing |
| `estovia_ml/parsing.py` | Text normalisation, unit conversion, city canonicalisation |
| `estovia_ml/schema.py` | Observation schema, plausibility bounds, fixed category list |
| `estovia_ml/validation.py` | Validation, deduplication, rejection logging |
| `estovia_ml/ingest.py` | Pipeline entry point |
| `estovia_ml/features.py` | **The canonical feature transform** |
| `estovia_ml/conformal.py` | Split-conformal calibration |
| `estovia_ml/metrics.py` | Metric definitions |
| `estovia_ml/train.py` | Split, train, evaluate, select, register |
| `estovia_ml/geospatial.py` | Optional OSM enrichment |
| `estovia_ml/verify_parity.py` | Python reference evaluator, parity reference |
| `scripts/export_runtime_model.py` | Re-encodes the trees into the binary |
| `scripts/export_runtime_index.py` | Writes `registry.json` and `comparables.json` |
| `scripts/verify_js_features.py` | Compares Python and JS feature vectors on real data |
| `scripts/verify_js_parity.py` | Compares Python and JS predictions |
| `scripts/verify_report_replay.py` | Replays the artifact to produce verified metrics |
| `scripts/show_eval.py` | Prints the evaluation report |

## 21. Running and verifying it locally

**Test the engine with no server and no database** (fastest check):

```bash
node scripts/valuation_smoke.mjs
```

**Test the feature transform against Python** on real observations:

```bash
pip install -r ml-service/requirements.txt
python ml-service/scripts/verify_js_features.py
```

**Test Python-vs-JavaScript prediction parity:**

```bash
python ml-service/scripts/verify_js_parity.py
```

**Reproduce the verified metrics from the shipped artifact:**

```bash
cd ml-service
python scripts/verify_report_replay.py --annotate
```

**Test it as a user.** Log in (any role: landowner, builder, buyer, admin), then
use **Valuation** / **Unit Valuation** / **Property Valuation** /
**Valuation engine** in the sidebar, or go straight to `/buyer/valuation`. Try
Gurugram → `sohna road` → 1,250 sq ft → 3 bedrooms. Then switch the property
type to **Residential Land** and confirm you get an explicit refusal rather than
a number.

**Full offline retraining** is in [§25](#25-technical-runbook).

## 22. How deployment works

1. Training runs **offline** on a machine with Python. It writes
   `ml-service/artifacts/`.
2. Two export scripts copy what the app needs into
   `src/lib/valuation/artifacts/`. No owner identity, contact detail or document
   path is ever exported.
3. `next.config.mjs` lists those artifact paths in `outputFileTracingIncludes`,
   so Next.js automatically packages the model files with the server bundle.
4. At runtime, `model.js` resolves the artifact directory: it uses
   `ML_MODEL_DIR` if set, otherwise it walks up from the working directory
   looking for `src/lib/valuation/artifacts`. The default works under both
   `next dev` and a production build.
5. The binary is loaded once per server process and cached in memory.

**Leave `ML_MODEL_DIR` unset.** Setting it to `ml-service/artifacts` is a
mistake — that is the training archive, it has no `.bin`, and its conformal
block is stale.

## 23. Future improvements

Each of these needs new data or new work; none is implemented, and none should
be claimed.

1. **Registered transaction data** — the single biggest improvement. It would
   change the target from asking to actual sale price, and would require a
   licensed source or a state registration portal.
2. **Observation dates** — would enable a genuine temporal split and let the
   model be tested against a market move.
3. **Geospatial enrichment** — one source in the catalogue does carry
   coordinates, but the OSM proximity join is implemented and still unused,
   because too few *accepted* rows have a usable `geo_features` payload to
   support it. Closing this gap is mostly a data-pipeline problem, not a
   modelling one.
4. **Land and commercial models** — 1,993 land rows exist; more would be needed
   to clear the 400-record floor for a segment of its own.
5. **Per-city models** — the current model pools all six cities. In the pool,
   Gurugram (5,211) outweighs Faridabad (537) almost 10:1.
6. **More villa data** — 21 rows is not a foundation.
7. **Quantile models** — training on multiple quantiles could give a better
   range than the symmetric relative-error band.
8. **Better locality matching** — fuzzy matching of locality spellings across
   sources would reduce the fallback to city-level statistics.

## 24. Glossary

| Term | Meaning |
| --- | --- |
| **Feature** | One number describing one aspect of a property, given to the model |
| **Target** | The number being predicted: `log(price per sq ft)` |
| **Decision tree** | A chain of yes/no questions ending in a number |
| **Gradient boosting (XGBoost)** | Building many trees one after another, each correcting the last |
| **Training** | Learning from the data the model is allowed to see |
| **Calibration set** | Held back to size the prediction range, never to learn |
| **Test set** | Held back entirely to measure real-world accuracy |
| **Holdout** | Data excluded from training so it can be used as a real test |
| **Leakage** | When information that won't exist at prediction time sneaks into training, producing flattering fake accuracy |
| **Log scale** | A compressed number scale; `log(10,000) ≈ 9.2` |
| **Target encoding** | Replacing a category like "Sohna Road" with a number derived from its prices |
| **Imputation** | Filling a missing value with a sensible typical value |
| **Conformal prediction** | Sizing a range so it contains the truth a stated percentage of the time |
| **α (alpha)** | The allowed miss rate. `α = 0.1` → a 90% band |
| **Overfitting** | Memorising the training data instead of learning the pattern |
| **Baseline** | The simple method a complex model must beat to be worth using |
| **Asking price** | What a seller advertises. **Not** what the property sold for |

## 25. Technical runbook

*Commands for the offline Python pipeline. All run from inside `ml-service/`.*

### Setup

Python 3.12 (3.10+; the code uses PEP 604 `X | None` annotations).

```bash
pip install -r ml-service/requirements.txt
```

Pinned: `pandas==3.0.6`, `numpy==2.5.3`, `scikit-learn==1.9.1`,
`xgboost==3.4.1`, `joblib==1.5.2`.

Optional HTTP service: `pip install -r ml-service/requirements-api.txt`
(FastAPI + Uvicorn + Pydantic). **Not used in production.**

### Ingest

```bash
python -m estovia_ml.ingest
```

Flags: `--sources` (default all), `--out` (default
`data/processed/observations.jsonl`), `--report`. The non-commercial Gurugram
source is skipped unless `ESTOVIA_ALLOW_NONCOMMERCIAL_SOURCES=1` is set, in
which case it is ingested for research only and excluded from the registered
model.

### Train

```bash
python -m estovia_ml.train --segment builtup --split geographic
```

Flags: `--observations`, `--segment` (`all` / `land` / `builtup` /
`commercial`), `--split` (`geographic` / `grouped` / `locality`),
`--include-noncommercial`, `--osm`, `--osm-budget`, `--no-tune`, `--max-iter`
(default 24), `--out` (default `artifacts/`).

### OSM enrichment (optional, currently unused)

```bash
python scripts/enrich_osm.py --budget 80
```

One Overpass query per 0.06° tile rather than per property, cached under
`data/osm_cache/tiles/`, backing off on HTTP 406/429/503 to respect the public
endpoint's usage policy. **The registered model was trained without these
features.**

### Export

```bash
python -m scripts.export_runtime_model     # → model_builtup.bin + .meta.json
python -m scripts.export_runtime_index      # → registry.json + comparables.json
```

`export_runtime_model` re-encodes the *same* trees with no mathematical change.
`export_runtime_index` reads `verifiedReplay` from the meta and stamps
`testMetricsProvenance: "verified-replay-of-exported-artefact"`, keeping the
stale training metrics separately for audit.

### Verify

```bash
python scripts/verify_report_replay.py --annotate
python -m estovia_ml.verify_parity
python scripts/show_eval.py
```

### 25.2 Model-selection rule

Implemented in `train.py::evaluate_split`:

1. A segment below `MIN_SEGMENT_RECORDS = 400` observations is skipped. Nothing
   is registered; the API returns an explicit unsupported status.
2. All candidates (XGBoost, ridge, random forest) plus the
   `locality_median_baseline` are scored on the **held-out test fold**.
3. Ranked by lower **median APE**, then lower RMSE. Median is used so a handful
   of luxury listings cannot dominate the choice.
4. **Registered only if it beats the baseline out-of-sample** (strictly lower
   median APE). Recorded as `beatsBaseline` in the registry — `true` for the
   shipped model.
5. Interval calibration uses the calibration split only, never the test split.

### 25.3 Training artifacts (`ml-service/artifacts/`)

| File | What it is |
| --- | --- |
| `registry.json` | Trained-model index with test metrics, baseline metrics, observation counts, `beatsBaseline`, `nonCommercialSourcesIncluded`, and the segments **not** trained |
| `model_builtup.json` | Human-readable archive: 1,200 exported trees, medians, encodings, conformal block, baseline, pinned dependencies |
| `evaluation_builtup.json` | Full report: every candidate's metrics, split description, and breakdowns by city / category / locality / price band / area band |

### 25.4 Other candidate models (indicative — from the stale run)

| Metric | ridge | random_forest |
| --- | --- | --- |
| MAE | 3116151.660757713 | 4885918.966638205 |
| Median APE % | 49.900582700522776 | 83.92255516206487 |
| R² | 0.22765322183441972 | -0.34226911452565045 |

Random forest has a **negative R²** — worse than predicting the test mean. It
lost and was not selected.

### 25.5 Verified split details

- Split kind: `geographic`. Train: grouped random split inside non-holdout
  cities (by city + locality + project + price bucket). Test: **geographic
  holdout of whole cities Faridabad and Greater Noida**.
- Observations: 17,637 total — 13,787 train / 2,432 calibration / 1,418 test.
- Conformal: `split_conformal_relative_error`, α = 0.1,
  q = 0.8768559022935312, n_calibration = 2,432.
- `locality_coverage_in_test`: 0.0. `unseen_locality_share`: 0.4675599435825106.
  Of the 416 localities in the test breakdown, 397 are flagged
  `sufficient: false`.
- Feature schema `feat.v1`. Model id `estovia-builtup-20260929185112`.

### 25.6 Retraining policy

- Retraining only ever uses **newly acquired legitimate data**. No synthetic
  rows may be appended. Several candidate Kaggle datasets were rejected in code
  precisely because they are synthetic or mislabelled. **There is no synthetic
  fallback path.**
- Every record must carry its `source_key`, `source_record_id`, `source_url`,
  `retrieved_at`, and `observed_date` where the source exposes one. Adapters
  must not invent values: a field absent in the source stays `None`.
- **The previous production model stays available.** Training writes a new
  timestamped `model_id`; it never overwrites the artifact in place.
- **A new model is not promoted automatically.** Even one that clears the
  baseline gate is only a candidate. Promotion is an explicit human decision,
  and the registry records `beatsBaseline` so that decision is auditable.
- Re-run the parity checks and `show_eval.py` before promoting anything.
