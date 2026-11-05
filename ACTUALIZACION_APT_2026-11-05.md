# Actualizacion de APT en imagenes - 05/11/2026

El CI de `786f25e` aprobo Java, React, secretos y los cinco E2E, pero el escaneo
de imagenes detecto CVE-2026-109518 en `apt` y su biblioteca: backend Jammy 2.4.14,
Maven y RabbitMQ Noble 2.8.3. Es un hallazgo publicado el 4/11, posterior al cierre
del tag. No se agregaron excepciones ni se redujo la severidad del control.

Fuente primaria: https://ubuntu.com/security/notices/USN-8996-1 y
https://ubuntu.com/blog/apt-vulnerability-fixes-available.

Las etapas de backend y Maven actualizan exclusivamente APT y sus dependencias
necesarias. Se exige al construir version >=2.4.15ubuntu0.1 en Jammy y
>=2.8.4ubuntu0.1 en Noble. Las descargas desactivan `Acquire::Retries` hasta aplicar
el parche, mitigacion indicada por Canonical. Se conserva la verificacion de firmas.

RabbitMQ de Compose se deriva del mismo digest/version anterior, aplica el mismo
parche y conserva el entrypoint/configuracion del broker. El escaneo apunta a la
imagen efectivamente construida y utilizada. No se modifica el RabbitMQ de Core.

La verificacion incluye reconstruccion de imagenes, arranque Compose, cinco E2E,
persistencia y el escaneo completo del CI. Su resultado se registra por revision,
sin atribuir a la primera corrida una aprobacion que no tuvo.
