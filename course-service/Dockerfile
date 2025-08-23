FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci 

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

EXPOSE 3002
USER node
CMD ["npm", "start"]