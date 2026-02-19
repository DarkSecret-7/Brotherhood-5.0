FROM nginx:alpine
COPY landing_page/ /usr/share/nginx/html/
# Add a build argument to bust the cache
ARG BUILD_DATE
RUN echo "Cache bust: $BUILD_DATE"
COPY ["docs/New Brotherhood Brochure (Social Reform).pdf", "/usr/share/nginx/html/manifesto.pdf"]
