FROM ubuntu
RUN apt update
RUN apt install apache2 apache-utils -y
RUN apt clean
RUN echo "Hello World!" > /var/www/html/index.html
EXPOSE 8080
CMD ["apache2ctl", "-D", "FOREGROUND"]