FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server /app/server
RUN mkdir -p /app/data/uploads
ENV PORT=8080
ENV DATA_DIR=/app/data
EXPOSE 8080
CMD ["/app/server"]
