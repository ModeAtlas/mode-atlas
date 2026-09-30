# Publishing the Mode Atlas website

GitHub Pages publishes the web release from `main`. The iOS application uses the
same frontend source through its existing native bundle builder.

## One-time setup

1. Merge the website deployment workflow into `main`.
2. Open the repository's **Settings → Pages → Build and deployment**.
3. Set **Source** to **GitHub Actions**, keeping the existing custom domain and
   HTTPS settings.
4. Open **Actions → Deploy Mode Atlas website → Run workflow**, select `main`,
   and run it. Wait for both `build` and `deploy` to succeed.

Subsequent pushes to `main` run the workflow automatically. Pull requests verify
and package the website without deploying it.

## Public artifact

`build_web.py` owns the website file list. It copies the committed public pages,
assets, root runtime scripts, legacy page redirects, PWA transport files, and
domain/search metadata unchanged into a new directory. It does not regenerate
the release or install native dependencies. Add new public routes to its file
list when introducing them.

The deployment does not invoke Jekyll or traverse `ios/`, `backend/`, tests, or
other development folders. In particular, the Capacitor Firebase Authentication
symlink is part of the native project, not the website artifact. Do not remove
that native dependency to repair a web deployment.

To verify packaging locally:

```sh
python3 -m unittest discover -s tests -p 'test_web_publish.py' -v
python3 build_web.py --output /tmp/mode-atlas-web
```

The output directory must not already exist. After a successful deployment, open
the website and use its **Check for updates** control to load the new release.
