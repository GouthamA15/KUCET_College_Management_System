# Use Node.js base image
FROM node:20-slim

# Install dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y 
    wget 
    gnupg 
    ca-certificates 
    procps 
    libgconf-2-4 
    libatk1.0-0 
    libatk-bridge2.0-0 
    libgdk-pixbuf2.0-0 
    libgtk-3-0 
    libgbm-dev 
    libnss3 
    libxss1 
    libasound2 
    fonts-liberation 
    libappindicator3-1 
    lsb-release 
    xdg-utils 
    --no-install-recommends 
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
