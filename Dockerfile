FROM maven:3.10.0-eclipse-temurin-21-noble@sha256:bde9fcc1d6849a2a627fffd4b2ff0824c855f060923c8a8bf7d010d2e263840d AS build

WORKDIR /build
COPY pom.xml ./
COPY src/main ./src/main
RUN mvn -B -ntp -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre-jammy@sha256:1eac8b8fee11ca7d6725a48bc5d41992ed1561504ebae25490d2d062847e8269 AS runtime

WORKDIR /app
RUN mkdir -p /app/archivos-documentos && chown -R 10001:10001 /app
COPY --from=build --chown=10001:10001 /build/target/ciudadanos-modulo1-0.0.1-SNAPSHOT.jar /app/app.jar

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+ExitOnOutOfMemoryError"
USER 10001:10001
EXPOSE 10000

# Render supplies PORT; Spring command-line arguments override local defaults.
CMD ["sh", "-c", "exec java -jar /app/app.jar --server.address=0.0.0.0 --server.port=${PORT:-10000}"]
