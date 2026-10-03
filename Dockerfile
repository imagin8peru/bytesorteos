FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY index.html styles.css app.js ./public/
COPY assets ./public/assets/
ENV NODE_ENV=production
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
