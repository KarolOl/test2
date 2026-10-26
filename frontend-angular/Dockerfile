FROM nginx:stable-alpine
ENV API_UPSTREAM=http://host.docker.internal:8080
ENV NGINX_ENVSUBST_FILTER="^API_UPSTREAM$"
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/40-settings.sh /docker-entrypoint.d/40-settings.sh
COPY --chmod=755 docker/50-csp.sh /docker-entrypoint.d/50-csp.sh
COPY docker/settings.awk /opt/app/settings.awk
COPY dist/frontend-angular/browser/settings.json /opt/app/settings.default.json
COPY dist/frontend-angular/browser/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
