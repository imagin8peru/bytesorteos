# ByteSorteos

Ruleta de Byte de tecnología con configuración de sorteos, importación CSV,
filtros, historial y vista en cámara. Esta versión procede del proyecto actual
del PC y no utiliza el servidor ni la interfaz de la versión anterior.

## Desarrollo local

Ejecutar `npm run dev` y abrir `http://127.0.0.1:4173`.
La vista en cámara está en `/?view=display`.

## Despliegue en Coolify

- Estrategia: Dockerfile en `/Dockerfile`.
- Directorio base: `/`.
- Puerto interno: `3000`.
- Dominio: `https://bytesorteos.imagin8.net.pe`.
- Comprobación de salud: `/health`.
- No requiere `APP_PASSWORD`. El acceso privado definitivo está pendiente.

Docker copia únicamente la aplicación y sus recursos a `public/`.
El servidor publica estos archivos y nunca las fuentes del servidor ni las
capturas de comprobación. No requiere instalar dependencias npm.

## Datos

Los CSV se procesan en el navegador. La configuración, participantes e historial
se conservan en el almacenamiento local del navegador. El VPS no almacena listas.
Utilizar datos ficticios mientras no esté incorporado el acceso privado.

La lista pública numerada, sus exportaciones y el envío de respaldos por correo
son funciones pendientes.
