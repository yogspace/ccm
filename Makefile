.PHONY: deploy

# Merged development → main und kehrt garantiert nach development zurück.
# Ablauf:
#   1. Working-Tree muss sauber sein (sonst brechen die Branch-Wechsel Änderungen
#      ab oder verschleppen sie) → harte Vorbedingung.
#   2. development pushen (der zu mergende Stand muss auf dem Remote sein).
#   3. main auschecken, aktuellen main-Stand holen, development mergen, pushen.
#   4. IMMER zurück zu development — auch wenn der Merge fehlschlägt (|| ... via
#      trap-ähnlichem Muster: der Rückwechsel steht als eigener, immer laufender
#      Schritt am Ende, Fehler im Merge stoppen vorher via `set -e`).
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
