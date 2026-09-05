# ByteSorteos

Primera versión desplegable de la ruleta privada para el canal.

## Desarrollo local

```bash
APP_PASSWORD=una-clave-segura npm start
```

Abrir `http://localhost:3000`.

## Coolify

- Tipo de recurso: aplicación desde repositorio Git.
- Construcción: Dockerfile.
- Puerto interno: `3000`.
- Dominio: `https://bytesorteos.imagin8.net.pe`.
- Variable secreta obligatoria: `APP_PASSWORD`.
- Health check: `/health`.

Los archivos CSV se leen en el navegador y no se envían al servidor.

## Estado

Esta versión establece el despliegue, acceso privado, interfaz base, CSV básico y motor funcional de la ruleta. El filtrado avanzado, Excel XLSX, cinco mensajes, sonidos, PWA e historial verificable se añadirán iterativamente.
