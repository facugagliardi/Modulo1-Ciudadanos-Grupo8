FROM rabbitmq:4.3-management@sha256:1cc652597e8d31d2bb4afc3be60f84961fe17aa4edc5bf067cbf9834afcc441b

# USN-8996-1: keep the broker version and apply the Ubuntu APT security update.
RUN apt-get -o Acquire::Retries=0 update \
    && apt-get -o Acquire::Retries=0 install -y --no-install-recommends --only-upgrade apt \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' apt)" ge 2.8.4ubuntu0.1 \
    && rm -rf /var/lib/apt/lists/*
