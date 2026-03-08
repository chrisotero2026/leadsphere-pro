FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npx", "prisma", "db", "push", "--schema=./prisma/schema.prisma", "&&", "node", "dist/index.js"]
