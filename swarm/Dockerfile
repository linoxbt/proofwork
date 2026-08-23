FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY . .

WORKDIR /app/swarm
CMD ["bun", "run", "bot.ts"]
