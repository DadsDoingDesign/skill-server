FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV SKILLS_DIR=/data/skills

VOLUME ["/data/skills"]
EXPOSE 3000

CMD ["node", "src/server.js"]
