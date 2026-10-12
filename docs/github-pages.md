# Publishing the Mode Atlas website

GitHub Pages publishes the web release from `main`. The iOS application uses the
same frontend source through its existing native bundle builder.

## One-time setup

1. Merge the website deployment workflow into `main`.
2. Open the repository's **Settings → Pages → Build and deployment**.
3. Set **Source** to **GitHub Actions**, keeping the existing custom domain and
   HTTPS settings.
4. Open **Actions → Mode Atlas release gate → Run workflow**, select `main`,
   and run it. After all three validation jobs pass, **Publish validated website**
   calls the website packaging and deployment workflow for that same commit.

Subsequent pushes to `main` run the release gate and then publish automatically. Development branch
pushes (`agent/mode-atlas-*`) and pull requests verify and package the website
without deploying it. Keep these deployment files on the development branch as
well as `main`, so later releases retain the fix.

The repository setting must use **GitHub Actions**. A successful custom workflow
does not prove that the old branch/Jekyll publisher has been disabled. If a
separate `pages build and deployment` run still invokes Jekyll, check the Source
setting above. Publishing the repository root from a branch is not supported for
this mixed web/iOS project.

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

## Release protection

`npm run release:check` runs the website packaging tests on every release. They
reproduce the broken native dependency link, reject links inside public files,
verify all page resources are present, and require a link-free artifact.

The release gate also packages the committed website before installing native
dependencies, then runs the desktop and mobile browser smoke tests against that
exact directory. The browser server cannot fall back to the repository root.
The Pages workflow is reusable-only (`workflow_call`). The release gate calls it
with `needs` on all three validation jobs and a main-branch condition; it cannot
publish independently through a push or manual Pages trigger. Packaging checks
run again before upload, using the same commit as the caller.

This uses one website packager (`build_web.py`) and one Pages deployment workflow
(`.github/workflows/deploy-pages.yml`). The iOS packager continues to own its
native payload. Website publishing changes do not change the app version or
Firebase configuration.

To verify packaging locally:

```sh
python3 -m unittest discover -s tests -p 'test_web_publish.py' -v
python3 build_web.py --output /tmp/mode-atlas-web
```

The output directory must not already exist. After a successful deployment, open
the website and use its **Check for updates** control to load the new release.
