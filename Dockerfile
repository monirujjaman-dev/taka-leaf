# syntax=docker/dockerfile:1
# One image with the API and the built web app, served together on port 8080.
# Dokploy builds this from the repository root (Build Type: Dockerfile, path: Dockerfile, context: .).

# 1. Web app
FROM node:22-alpine AS web
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY contract contract
COPY apps/web apps/web
RUN pnpm --filter @takaleaf/web build

# 2. API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY global.json ./
COPY backend/TakaLeaf.App/TakaLeaf.App.csproj backend/TakaLeaf.App/
RUN dotnet restore backend/TakaLeaf.App/TakaLeaf.App.csproj
COPY backend/TakaLeaf.App backend/TakaLeaf.App
RUN dotnet publish backend/TakaLeaf.App/TakaLeaf.App.csproj -c Release -o /out --no-restore -p:UseAppHost=false

# 3. Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /out ./
COPY --from=web /src/apps/web/dist ./wwwroot
# Log files and data protection keys go here; mount volumes on /app/logs and /app/keys to keep
# them across deploys.
RUN mkdir -p /app/logs /app/keys && chown "$APP_UID" /app/logs /app/keys
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Database__MigrateOnStartup=true \
    DataProtection__KeysPath=/app/keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "TakaLeaf.App.dll"]
