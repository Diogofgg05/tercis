FROM node:22-alpine
WORKDIR /app
COPY scripts/clamav-gateway.mjs ./gateway.mjs
USER node
EXPOSE 8787
CMD ["node","gateway.mjs"]
