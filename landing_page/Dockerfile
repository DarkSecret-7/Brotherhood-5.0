FROM nginx:alpine
COPY landing_page/static/ /usr/share/nginx/html/
COPY landing_page/inject-env.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh
# Add a build argument to bust the cache
ARG BUILD_DATE
RUN echo "Cache bust: $BUILD_DATE"
RUN mkdir -p /usr/share/nginx/html/docs
COPY ["docs/New Brotherhood Brochure (Social Reform).pdf", "/usr/share/nginx/html/docs/New Brotherhood Brochure (Social Reform).pdf"]
COPY ["docs/New Brotherhood Brochure (Learners).pdf", "/usr/share/nginx/html/docs/New Brotherhood Brochure (Learners).pdf"]
