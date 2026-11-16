FROM postgres:16-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab
# Use the Alpine privilege-dropper and remove the old Go binary entirely.
# Require the Alpine fixes for the Kerberos and libxslt findings in Testing G3.
RUN apk add --no-cache su-exec 'krb5-libs>=1.22.3-r0' 'libxslt>=1.1.43-r4' \
    && sed -i 's/exec gosu postgres/exec su-exec postgres/' /usr/local/bin/docker-entrypoint.sh \
    && ! grep -q gosu /usr/local/bin/docker-entrypoint.sh \
    && rm /usr/local/bin/gosu /usr/local/bin/su-exec \
    && su-exec postgres id
