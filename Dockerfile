# Use node image for building the app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json first to leverage Docker caching
COPY package.json package-lock.json ./
RUN npm install

# Copy the entire project
COPY . . 

# Build the Vue app
RUN npm run build

# Use Nginx for serving the built Vue app
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Copy the built Vue app
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure favicon.ico and static assets are copied
COPY --from=builder /app/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
