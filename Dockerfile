FROM node:22-slim

# Install dependencies for Playwright and xvfb
RUN apt-get update && apt-get install -y \
    xvfb \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (this will also run postinstall to get Playwright browsers)
RUN npm ci

# Copy application code
COPY . .

# Set display for xvfb
ENV DISPLAY=:99

# Start xvfb and then the app
CMD Xvfb :99 -screen 0 1280x720x24 & npm start
