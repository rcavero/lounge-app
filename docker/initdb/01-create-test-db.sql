-- PostgreSQL ejecuta este fichero UNA SOLA VEZ: la primera vez que arranca el
-- contenedor con el volumen vacío. Si cambias algo aquí, hace falta un
-- `npm run db:down -- -v` para que vuelva a correr.
--
-- POSTGRES_DB del compose ya crea `lounge_dev`; aquí solo añadimos la de tests.
CREATE DATABASE lounge_test OWNER lounge;
