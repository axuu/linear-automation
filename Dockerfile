FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Run the archive CLI script
CMD ["npx", "tsx", "scripts/archive-cli.ts"]
