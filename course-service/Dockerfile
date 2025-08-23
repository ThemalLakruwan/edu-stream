FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci 

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY package*.json ./

EXPOSE 3002
USER node
CMD ["npm", "start"]