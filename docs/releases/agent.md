# Releasing `@called-it/agent`

The canonical consumer version is `packages/agent/package.json`.
Generated runtime, distribution, and installed-skill manifests must derive from that value.
The release tag and GitHub release must use `agent-v<version>`.

Do every release from a clean checkout of the intended `origin/main` commit.
Do not continue if any verification, ownership, inventory, tag, or version check disagrees.

1. Authenticate to npm with the maintainer account and confirm that the account controls the `@called-it` scope.

   ```sh
   npm whoami
   npm access list packages @called-it --json
   npm view @called-it/agent name version dist-tags --json
   ```

   As of 2026-07-17, the public registry returns `404` for `@called-it/agent`, and npm's public organization and user pages both report that the `called-it` scope does not exist.
   No current scope owner is publicly listed.
   An authorized maintainer must claim the user scope or create the organization scope, authenticate, and confirm ownership before the first publish.

2. Set the next version only in the canonical package metadata, then refresh the lockfile.

   ```sh
   npm version <new-version> --workspace @called-it/agent --no-git-tag-version
   bun install --lockfile-only
   ```

   Update documentation only when it contains a concrete consumer version.
   Do not manually edit generated changelogs.

3. Build and run the full repository and consumer gates.

   ```sh
   bun install --frozen-lockfile
   bun run lint
   bun run typecheck
   bun run test
   NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3002 bun run build:web
   bun run --cwd packages/agent verify:distribution
   npm pack --dry-run --json --ignore-scripts ./packages/agent
   ```

   Confirm the dry-run inventory contains only `package.json`, `README.md`, `LICENSE`, the Node bootstrap, the versioned Bun runtime, the complete skill, Bird 0.8.0, manifests, and license files.

4. Verify the tag and release names derive from the canonical version.

   ```sh
   VERSION=$(node -p "require('./packages/agent/package.json').version")
   test "$(bun packages/agent/dist/runtime/called-it.mjs --version)" = "$VERSION"
   git rev-parse "agent-v${VERSION}" >/dev/null 2>&1 && exit 1 || true
   gh release view "agent-v${VERSION}" >/dev/null 2>&1 && exit 1 || true
   ```

5. Merge the reviewed release commit before performing any external release action.
   From a clean checkout of that exact merged commit, rebuild and repeat step 3.

6. Create the local annotated tag, perform a final package preview, and publish the exact package directory.

   ```sh
   VERSION=$(node -p "require('./packages/agent/package.json').version")
   git tag -a "agent-v${VERSION}" -m "@called-it/agent ${VERSION}"
   npm publish --access public ./packages/agent
   ```

   If npm publication fails, do not push the tag or create a GitHub release.

7. After npm confirms the exact version, push only that tag and create the matching GitHub release from it.

   ```sh
   git push origin "agent-v${VERSION}"
   gh release create "agent-v${VERSION}" --verify-tag --title "@called-it/agent ${VERSION}" --generate-notes
   npm view @called-it/agent version
   gh release view "agent-v${VERSION}"
   ```

The final npm version, CLI `--version`, runtime manifest, skill manifest, git tag, and GitHub release must all equal `VERSION`.
