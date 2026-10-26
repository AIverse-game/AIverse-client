.PHONY: check verify

# Repository scaffold: links and text formatting (Python only).
check:
	python3 scripts/check_repo.py

# Scaffold plus application checks; needs `npm install` first.
verify: check
	npm run verify
