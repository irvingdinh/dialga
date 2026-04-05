.PHONY: lint kill dev build

lint:
	@cd agent && bun run lint && bun run format && bun run build
	@cd api && bun run lint && bun run format && bun run build
	@cd ui && bun run lint:fix && bun run build

kill:
	@-lsof -ti :48300 | xargs kill -15 2>/dev/null; true
	@-lsof -ti :48310 | xargs kill -15 2>/dev/null; true

dev: kill
	@echo "" & \
	cd api && bun run start & \
	cd ui && bun run dev & \
	wait

build:
	@cd api && bun run build
	@cd ui && bun run build
