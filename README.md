# Gestor de Alertas de Boletines Oficiales

Sistema interno para la configuración y gestión de alertas automáticas sobre Boletines Oficiales (Neuquén y BORA). Permite administrar las palabras clave y destinatarios que los flujos de n8n utilizan para generar reportes diarios por email.

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Arquitectura](#arquitectura)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Configuración de Credenciales](#configuración-de-credenciales)
- [Uso](#uso)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [API Reference](#api-reference)
- [Flujos n8n](#flujos-n8n)
- [Seguridad](#seguridad)
- [Integración con n8n](#integración-con-n8n)

---

## Descripción General

Este sistema resuelve la necesidad de monitorear diariamente los **Boletines Oficiales** (municipales, provinciales y nacionales) en busca de términos de interés periodístico, fiscal o editorial.

Cada día a las 5:00 AM, los flujos de n8n:

1. Descargan y analizan el contenido de los Boletines Oficiales
2. Comparan el contenido contra las palabras clave configuradas
3. Envían reportes por email a los destinatarios configurados (por grupo o de forma personalizada)

Este repositorio contiene la **herramienta web de administración** que permite gestionar esas palabras clave y destinatarios de forma visual, sin necesidad de editar archivos manualmente.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    MÁQUINA LOCAL (Windows)                   │
│                                                             │
│  ┌──────────────────────┐      ┌───────────────────────┐   │
│  │   Interfaz Web       │      │    config.json         │   │
│  │   (Vue 3 + Tailwind) │─────▶│  (fuente de verdad)   │   │
│  │   puerto :3000       │      └──────────┬────────────┘   │
│  └──────────────────────┘                 │                  │
│                                           │                  │
│  ┌──────────────────────┐                 │                  │
│  │   API REST           │                 │                  │
│  │   (Express.js)       │─────────────────┘                  │
│  │   Autenticación      │                                     │
│  │   por sesión         │                                     │
│  └──────────────────────┘                                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                          │
                          │ SSH (lee config.json)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR n8n (remoto)                      │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Flujo 1: Boletines Neuquén (Ciudad + Provincia)       │ │
│  │  - Descarga PDFs de boletinoficial.neuquen.gov.ar      │ │
│  │  - Descarga PDFs de neuquencapital.gov.ar              │ │
│  │  - Extrae texto y busca coincidencias                  │ │
│  │  - Envía emails por grupo e individualmente            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Flujo 2: BORA (Boletín Oficial República Argentina)   │ │
│  │  - Scrappea las 3 secciones del BORA                   │ │
│  │  - Filtra avisos por título según palabras clave       │ │
│  │  - Descarga el detalle de cada aviso relevante         │ │
│  │  - Envía emails por grupo e individualmente            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Gmail OAuth2
                          ▼
                   Destinatarios finales
```

---

## Tecnologías Utilizadas

### Backend (Servidor local)
| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| Express.js | ^4.18.2 | Servidor HTTP y API REST |
| cors | ^2.8.5 | Headers CORS |
| crypto | built-in | Generación de tokens de sesión |

### Frontend (Interfaz web)
| Tecnología | Versión | Propósito |
|---|---|---|
| Vue 3 | CDN | Framework reactivo |
| Tailwind CSS | CDN | Estilos utilitarios |
| FontAwesome 6 | CDN | Íconos |

### Automatización
| Tecnología | Propósito |
|---|---|
| n8n | Orquestador de flujos |
| Gmail OAuth2 | Envío de alertas |
| SSH | Lectura remota de `config.json` |

---

## Requisitos Previos

- **Node.js** versión 18 o superior ([descargar](https://nodejs.org/))
- **npm** (incluido con Node.js)
- Acceso al servidor n8n con credencial SSH configurada
- Cuenta de Gmail con OAuth2 configurada en n8n

---

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd GestorPalabrasWeb
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear el archivo de configuración

Copiar el archivo de ejemplo y editarlo con los datos reales:

```bash
copy config.example.json config.json
```

Editar `config.json` con las palabras clave y emails reales. Ver [Estructura del config.json](#estructura-del-configjson).

### 4. Configurar credenciales de acceso

Las credenciales de la herramienta web se definen directamente en `server.js`:

```javascript
// server.js — línea ~12
const USERS = {
  'admin': 'tu-contraseña-segura'
};
```

> **⚠️ Importante:** Cambiar la contraseña por defecto antes de exponer el servicio a la red.

### 5. Iniciar el servidor

**En Windows (modo fácil):**
```
INICIAR_WEB.bat
```

**Modo manual:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

---

## Configuración de Credenciales

### Credenciales del sistema web

Definidas en `server.js` en el objeto `USERS`. Para agregar usuarios:

```javascript
const USERS = {
  'admin': 'contraseña-admin',
  'editor': 'contraseña-editor'
};
```

Las sesiones duran **8 horas** y se invalidan automáticamente. El token de sesión es un valor hexadecimal de 64 caracteres generado con `crypto.randomBytes`.

### Estructura del config.json

```json
{
  "neuquenLocal": {
    "id": "neuquenLocal",
    "name": "Boletines Neuquén (Ciudad y Provincia)",
    "description": "Texto descriptivo",
    "keywords": ["lista", "de", "palabras clave"],
    "emails": ["destinatario1@empresa.com", "destinatario2@empresa.com"]
  },
  "boraGroup1": {
    "id": "boraGroup1",
    "name": "BORA: Vaca Muerta / Energía",
    "keywords": [...],
    "emails": [...]
  },
  "boraGroup2": {
    "id": "boraGroup2",
    "name": "BORA: Neuquén / Río Negro",
    "keywords": [...],
    "emails": [...]
  },
  "individuals": [
    {
      "email": "persona@empresa.com",
      "keywords": ["palabra1", "palabra2"]
    }
  ]
}
```

> El archivo `config.json` **no debe subirse a Git** (ya está en `.gitignore`) porque contiene emails reales y términos sensibles.

---

## Uso

### Interfaz Web

Al ingresar a `http://localhost:3000` se muestra una pantalla de login.

Tras autenticarse, la interfaz tiene 4 pestañas:

| Pestaña | Descripción |
|---|---|
| Boletines Neuquén (Ciudad y Provincia) | Keywords y destinatarios del boletín local |
| BORA: Vaca Muerta / Energía | Keywords del Boletín Oficial Nacional — sector energético |
| BORA: Neuquén / Río Negro | Keywords del Boletín Oficial Nacional — región patagónica |
| Usuarios Individuales | Personas con sus propias palabras clave personalizadas |

**Operaciones disponibles en cada pestaña:**
- ➕ Agregar palabra clave
- ❌ Eliminar palabra clave
- ➕ Agregar email destinatario
- ❌ Eliminar email destinatario

**Pestaña "Usuarios Individuales":**
- ➕ Agregar un email individual
- Asignar palabras clave exclusivas a esa persona
- Esa persona recibirá **un email separado y personalizado** con solo los artículos que coincidan con sus palabras

---

## Estructura del Proyecto

```
GestorPalabrasWeb/
│
├── server.js              # API REST + autenticación por sesión
├── package.json           # Dependencias del proyecto
├── INICIAR_WEB.bat        # Script de inicio para Windows
├── config.json            # ⚠️ NO subir a Git — datos reales
├── config.example.json    # Estructura de referencia para auditores
├── .gitignore
├── README.md
│
├── public/                # Archivos estáticos servidos por Express
│   ├── index.html         # App completa (Vue 3, login, dashboard)
│   ├── logo.png           # Logotipo institucional
│   └── favicon.svg        # Ícono de pestaña del navegador
│
└── n8n/                   # Flujos de n8n listos para importar
    ├── Flujo_1_Neuquen.json    # Boletines Neuquén + Individuales
    └── Flujo_2_BORA.json       # BORA + Individuales
```

---

## API Reference

Todos los endpoints de `/api/` (excepto `/api/login`, `/api/logout` y `/api/me`) requieren una sesión activa.

### Autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/login` | Iniciar sesión. Body: `{ "username": "...", "password": "..." }` |
| `POST` | `/api/logout` | Cerrar sesión. Invalida la cookie de sesión |
| `GET` | `/api/me` | Verificar si la sesión actual es válida |

### Configuración de Grupos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/config` | Obtener toda la configuración |
| `POST` | `/api/config/:groupId/keywords` | Agregar keyword. Body: `{ "keyword": "..." }` |
| `DELETE` | `/api/config/:groupId/keywords/:keyword` | Eliminar keyword |
| `POST` | `/api/config/:groupId/emails` | Agregar email. Body: `{ "email": "..." }` |
| `DELETE` | `/api/config/:groupId/emails/:email` | Eliminar email |

**`groupId` válidos:** `neuquenLocal`, `boraGroup1`, `boraGroup2`

### Usuarios Individuales

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/individuals` | Listar todos los individuos |
| `POST` | `/api/individuals` | Agregar individuo. Body: `{ "email": "..." }` |
| `DELETE` | `/api/individuals/:email` | Eliminar individuo y sus keywords |
| `POST` | `/api/individuals/:email/keywords` | Agregar keyword a individuo |
| `DELETE` | `/api/individuals/:email/keywords/:keyword` | Eliminar keyword de individuo |

---

## Flujos n8n

Los archivos JSON en la carpeta `n8n/` son los flujos listos para importar en n8n.

### Cómo importar en n8n

1. Abrir n8n y acceder al canvas del flujo correspondiente
2. Seleccionar todos los nodos (`Ctrl+A`) y borrarlos (`Delete`)
3. Copiar el contenido del archivo JSON
4. Pegar en el canvas vacío (`Ctrl+V`)
5. Verificar que la credencial SSH **"SSH SCH-FM-01590"** esté disponible
6. Verificar que la credencial Gmail OAuth2 esté disponible
7. Guardar y activar

### Flujo 1 — Boletines Neuquén

**Origen de datos:**
- `https://boletinoficial.neuquen.gov.ar/Boletines` (Boletín Provincia)
- `https://www.neuquencapital.gov.ar/boletin-oficial/` (Boletín Ciudad)

**Lógica:**
1. Lee `config.json` via SSH
2. Descarga los PDFs de ambas fuentes
3. Extrae el texto completo del PDF
4. Busca coincidencias de palabras clave por párrafo (búsqueda por palabra completa, `\bpalabra\b`)
5. Envía un email grupal + emails personalizados por individuo

### Flujo 2 — BORA (Boletín Oficial República Argentina)

**Origen de datos:**
- `https://www.boletinoficial.gob.ar/seccion/primera`
- `https://www.boletinoficial.gob.ar/seccion/segunda`
- `https://www.boletinoficial.gob.ar/seccion/tercera`

**Lógica:**
1. Lee `config.json` via SSH
2. Scrappea los títulos de avisos de las 3 secciones
3. Filtra por coincidencia de keywords en el título
4. Descarga el detalle de cada aviso filtrado (con rate-limit de 1 segundo)
5. Acumula todos los textos y genera un email por grupo + emails personalizados por individuo

### Credencial SSH requerida en n8n

El nodo **"Leer Config"** usa SSH para leer el archivo `config.json` de la máquina local:

```
Comando: cmd.exe /c "chcp 65001 > nul && type C:\GestorPalabrasWeb\config.json"
Credencial: SSH SCH-FM-01590 (id: 6bwjVuD8AffpTJCg)
```

> Asegurarse de que el servidor n8n tenga acceso SSH a la máquina local donde corre este sistema.

---

## Seguridad

### Mecanismo de autenticación

- **Tipo:** Sesiones basadas en cookies `HttpOnly`
- **Token:** 32 bytes aleatorios (`crypto.randomBytes`) → 64 caracteres hexadecimales
- **Almacenamiento:** En memoria del proceso Node.js (no persiste reinicios)
- **Duración:** 8 horas por sesión
- **Cookie flags:** `HttpOnly`, `SameSite=Strict` (protección CSRF)

### Lo que NO hace este sistema

- ❌ No usa HTTPS de forma nativa — para producción se recomienda poner un proxy inverso (nginx) con certificado TLS
- ❌ Las sesiones no persisten si el servidor Node.js se reinicia
- ❌ No hay límite de intentos de login (considerar agregar rate-limiting para ambientes expuestos)

### Datos sensibles

| Dato | Dónde vive | Incluido en Git |
|---|---|---|
| Emails de destinatarios | `config.json` | ❌ No |
| Palabras clave | `config.json` | ❌ No |
| Contraseña web | `server.js` (hardcoded) | ✅ Sí — **cambiar antes de subir** |
| ID credencial Gmail n8n | Archivos JSON n8n | ✅ Sí — es solo el ID interno de n8n |

> **Recomendación para el responsable de sistemas:** Mover las credenciales de `server.js` a variables de entorno (`.env`) antes de un despliegue en servidor compartido.

---

## Exposición a Red Externa (Opcional)

Por defecto el sistema corre en `localhost:3000`. Para acceso remoto se recomienda una de estas opciones:

| Opción | Uso recomendado |
|---|---|
| **Cloudflare Tunnel** | Acceso permanente desde internet, sin abrir puertos |
| **Tailscale** | Acceso privado entre equipos del equipo (VPN mesh) |
| **Ngrok** | Testing rápido y temporal |

---

*Proyecto desarrollado para uso interno editorial — Neuquén, Argentina.*
