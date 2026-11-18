FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# ADMIN_PIN is a secret: pass it at runtime with `docker run -e ADMIN_PIN=...` (or your secret manager).
CMD ["node", "server.js"]
