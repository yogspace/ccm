.PHONY: deploy up-db down-db

# The local MongoDB for `pnpm dev` (docker-compose.dev.yml, port 27018) –
# start it before working, stop it when done. The data stays in its volume.
up-db:
	docker compose -f docker-compose.dev.yml up -d

down-db:
	docker compose -f docker-compose.dev.yml down

# Merges development → main and is sure to return to development.
# Steps:
#   1. The working tree must be clean (otherwise switching branches aborts or
#      drags changes along) → hard precondition.
#   2. Push development (the state to merge must be on the remote).
#   3. Check out main, pull the current main, merge development, push.
#   4. ALWAYS back to development — even if the merge fails (|| ... in a
#      trap-like pattern: switching back is its own step at the end that always
#      runs; errors in the merge stop earlier via `set -e`).
deploy:
	@set -e; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "✗ Working-Tree ist nicht sauber. Bitte erst committen/stashen."; \
		git status --short; \
		exit 1; \
	fi; \
	START_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$START_BRANCH" != "development" ]; then \
		echo "✗ Nicht auf development (aktuell: $$START_BRANCH). Abbruch."; \
		exit 1; \
	fi; \
	echo "→ push development"; \
	git push origin development; \
	echo "→ checkout main + pull"; \
	git checkout main; \
	git pull --ff-only origin main; \
	echo "→ merge development → main"; \
	if git merge --no-edit development; then \
		echo "→ push main"; \
		git push origin main; \
		echo "✓ development nach main gemerged und gepusht."; \
	else \
		echo "✗ Merge-Konflikt. Bitte manuell lösen; kehre zu development zurück."; \
		git merge --abort || true; \
		git checkout development; \
		exit 1; \
	fi; \
	echo "→ zurück zu development"; \
	git checkout development
