# Bundled iOS fonts

Inter, Sora and Noto Sans JP are distributed under the SIL Open Font License 1.1.
Each original license is included here. Binary font files are unmodified.

Source: Fontsource variable build dependencies, pinned to 5.3.0 in package-lock.json. All normal weight-axis
subsets are included, including Japanese kanji used in saved vocabulary. CSS
unicode ranges let WebKit load only the subsets a screen needs. Website font
transport remains separate; iOS never requests Google Fonts.

To prepare the font assets:

```sh
npm ci
python3 build_ios_fonts.py
```

`npm ci` verifies the lockfile's package integrity. Revision/native builds run
the preparation step automatically and perform no font downloads themselves.
Generated WOFF2 files are ignored in Git and included in the native web payload.
The signed app contains every subset it needs; it never requests fonts online.
