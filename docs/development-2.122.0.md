# Mode Atlas 2.122.0 - Clearer study-streak flame

iOS build **2080045**.

The homepage flame had an overlapping silhouette that was difficult to recognise at its small display size. The owning `icon-flame` symbol in `assets/mode-atlas-icons.svg` now uses a clean outer flame and a small inner flame. Every existing consumer receives the same correction. Colour, layout, streak calculations and accessibility labels are unchanged.

The icon was inspected at its rendered size in simulated iOS light and dark appearances and in the web layout. Before the release metadata update, the full browser suite passed 674 tests; the release checks passed 258 JavaScript and 16 Python tests. The release gate checks the final generated assets and native bundle.

No Firebase deployment or save migration is required. Native users receive the change in the next installed app build.
