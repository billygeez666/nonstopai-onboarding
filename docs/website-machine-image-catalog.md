# Website Machine hero image catalog

The generator uses a small, fixed Unsplash catalog. It chooses the first verified service supplied by the customer, then the recognized industry, then a neutral office image. Customer-provided URLs are never used as image sources. The images are labelled as illustrative and are not presented as the business's staff, premises, or completed work.

| Category | Photo | Photographer | Source |
| --- | --- | --- | --- |
| Boiler and heating | Engineer repairing a domestic water heater | Timur Shakerzianov | [Unsplash photo](https://unsplash.com/photos/a-man-fixing-a-water-heater-in-a-room-kxuz4YrLxSc) |
| Plumbing | Plumber repairing bathroom pipework | bhagya laxmi | [Unsplash photo](https://unsplash.com/photos/a-plumber-repairs-plumbing-in-a-bathroom-jaP5ClBdIyU) |
| Electrical | Electrician working on indoor wiring | Rendy Novantino | [Unsplash photo](https://unsplash.com/photos/electrician-works-on-wiring-from-a-ladder-indoors-RGAYO3FGIwY) |
| Roofing | Roofer removing residential roof shingles | Zohair Mirza | [Unsplash photo](https://unsplash.com/photos/person-removing-shingles-from-roof-GXITWKvgm-k) |
| Cleaning | Person mopping a modern living-room floor | Vitaly Gariev | [Unsplash photo](https://unsplash.com/photos/a-woman-mops-a-bright-modern-living-room-floor-2NcTLdFHpH8) |
| Beauty | Person receiving a facial treatment | kimia kazemi | [Unsplash photo](https://unsplash.com/photos/a-person-receiving-a-facial-treatment-RbIcMsh0NSk) |
| Garage and vehicle care | Cars being repaired in a workshop | Winston Chen | [Unsplash photo](https://unsplash.com/photos/cars-being-repaired-in-a-workshop-VdXnpwrp1qc) |
| Restaurant and food | Table of restaurant food | Redd Francisco | [Unsplash photo](https://unsplash.com/photos/a-table-full-of-food-0KGiGx6_di0) |
| Garden and outdoors | Gardener watering plants with a hose | Zhen Yao | [Unsplash photo](https://unsplash.com/photos/gardener-watering-plants-with-a-hose-in-a-park-cObAiqAJXHs) |
| Neutral fallback | Room with desk and chairs | Mateusz Zatorski | [Unsplash photo](https://unsplash.com/photos/a-room-with-a-desk-and-chairs-in-front-of-a-large-window-wN9oyogyjQc) |

All catalog images are marked free to use under the [Unsplash License](https://unsplash.com/license), which permits commercial and non-commercial use without attribution. Attribution is listed above for traceability. Unsplash notes that its copyright license does not grant rights to trademarks, recognizable people, or other copyrighted works appearing in a photograph; images are therefore explicitly illustrative and should be replaced with the customer's own approved photographs where available. The category-specific Unsplash photo pages were checked during implementation.

The HTML requests responsive 640, 960, or 1440 pixel variants from `images.unsplash.com`; no Unsplash API, API credential, generation model, or per-request search is used. This keeps the output small but means the published site needs network access to Unsplash's CDN. A broken or blocked image leaves the template's dark hero background visible.
