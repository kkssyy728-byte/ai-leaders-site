# Static mirror workflow

GitHub Pages serves files without server-side routing, so clean URLs such as
`/about/` need a physical `about/index.html`. This repository keeps the legacy
`/html/*.html` URLs for compatibility while publishing the clean folder routes.

## Single source of truth

- Edit pages only in `html/*.html`.
- Edit shared JavaScript only in `html/assets/`.
- Treat root `index.html`, each `*/index.html`, and root `assets/` as generated
  public mirrors.
- `html/course-detail.html` intentionally generates both
  `course-detail/index.html` and the preferred `course/index.html` alias.

After editing a source file, synchronize its public mirrors:

```powershell
node tools/sync-static-mirrors.mjs --sync
```

Before committing, verify that no mirror drift remains:

```powershell
node tools/sync-static-mirrors.mjs --check
```

The check runs in GitHub Actions on pushes and pull requests. When a new
`html/*.html` page is added, add its public destination to `pageMirrors` in
`tools/sync-static-mirrors.mjs`; an undeclared page makes the check fail.
