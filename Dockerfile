FROM mongo:4.4

COPY ./openssl-db-key /etc/secrets/openssl-db-key
RUN chown mongodb:mongodb /etc/secrets/openssl-db-key \
  && chmod 600 /etc/secrets/openssl-db-key
