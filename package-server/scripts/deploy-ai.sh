#!/bin/bash

set -e

SERVICE_NAME="galaxy-package-ai-service"
IMAGE_NAME="galaxy-package-ai-service"
IMAGE_TAG="latest"
NETWORK_NAME="package-network"

echo "🔨 Building AI service image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ./ai-service

echo "🔍 Ensuring docker network '${NETWORK_NAME}' exists..."
docker network inspect ${NETWORK_NAME} >/dev/null 2>&1 || docker network create ${NETWORK_NAME}

if [ "$(docker ps -q -f name=${SERVICE_NAME})" ]; then
  echo "🛑 Stopping existing container ${SERVICE_NAME}"
  docker stop ${SERVICE_NAME}
fi

if [ "$(docker ps -aq -f name=${SERVICE_NAME})" ]; then
  echo "🗑️  Removing existing container ${SERVICE_NAME}"
  docker rm ${SERVICE_NAME}
fi

echo "🚀 Starting AI service container '${SERVICE_NAME}' on network '${NETWORK_NAME}'"
docker run -d \
  --name ${SERVICE_NAME} \
  --network ${NETWORK_NAME} \
  ${IMAGE_NAME}:${IMAGE_TAG}

echo "✅ AI service is running (internal port 9090)."
echo "ℹ️  Node should use: AI_SERVICE_URL=http://${SERVICE_NAME}:9090"


