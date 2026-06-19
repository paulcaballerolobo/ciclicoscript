---
name: ciclico-design
description: Sistema de diseño de Cíclico (esciclico.com), plataforma de periodismo político y datos. Úsalo SIEMPRE que construyas cualquier página, herramienta, componente o interfaz para Cíclico — herramientas de datos (calculadoras, comparadores, timelines), páginas editoriales, secciones de landing, newsletters, dashboards, o cualquier elemento visual. Actívalo también cuando el usuario diga "estilo Cíclico", "que siga el diseño de Cíclico", "para esciclico", o pida igualar/extender el sistema visual. Usalo antes de escribir HTML, CSS o JS para el ecosistema Cíclico.
---

# Cíclico Design System (v2)

Cíclico es una plataforma de periodismo político y datos para Argentina. La identidad
combina **rigor editorial** con **claridad de datos**: base clara por defecto (papel),
modo oscuro automático, serif con carácter para titulares y naranja como único acento.
Stack siempre **HTML/CSS/JS vanilla** en un único archivo autocontenido. No usar React,
Vue ni frameworks CSS externos, salvo Google Fonts.

> **Cambios respecto a v1:** ya NO es dark-only (ahora claro por defecto + oscuro auto),
> ya NO se usa Syne/DM Mono/Instrument Sans (ahora Anton/Poppins/Inter), y el
> logo es una **imagen** (`/logo.svg`), no el círculo CSS "CI".

---

## Tokens de diseño

### Colores (CSS variables obligatorias)

Tema **claro por defecto** + override automático a **oscuro**. El naranja sigue siendo
el único acento de marca.

```css
:root {
  /* Marca */
  --orange:     #FF5500;   /* fill de marca — botones, barras, highlights */
  --orange-ink: #D94400;   /* naranja para TEXTO/links sobre fondo claro (accesible) */
  --orange-dim: #CC4400;   /* hover */

  /* Superficies (claro / papel) */
  --bg:       #FBFAF7;     /* fondo de página — blanco cálido, nunca #FFF puro */
  --bg-card:  #FFFFFF;     /* tarjetas, paneles */
  --bg-card2: #F2F0EB;     /* tarjetas secundarias, inputs */
  --border:   #E3E0D8;     /* bordes, separadores */

  /* Texto */
  --text:  #16140F;        /* texto principal — casi negro, nunca #000 puro */
  --muted: #6B6760;        /* secundario, labels, placeholders */

  /* Datos */
  --green: #1A8F5E;        /* positivos, confirmaciones */
  --red:   #D23B3B;        /* negativos, alertas */

  --shadow: 0 1px 2px rgba(22,20,15,0.04), 0 4px 16px rgba(22,20,15,0.06);
}

@media (prefers-color-scheme: dark) {
  :root {
    --orange:     #FF6A1F;
    --orange-ink: #FF8A4D;
    --orange-dim: #E0560F;

    --bg:       #0E0E0E;
    --bg-card:  #161616;
    --bg-card2: #1E1E1E;
    --border:   #2A2A2A;

    --text:  #F0EDE8;
    --muted: #8A857C;

    --green: #3ECF8E;
    --red:   #FF5959;

    --shadow: none;        /* en oscuro: bordes en vez de sombra */
  }
}
```

Reglas: un solo acento (naranja). Nunca blanco puro ni negro puro. Para texto/links en
naranja sobre fondo claro usar `--orange-ink` (contraste); el `--orange` crudo solo como
fill o sobre fondo oscuro. Nunca gradientes de color (sí capas con rgba).

### Tipografía

Las fuentes de marca de Cíclico son **Anton**, **Poppins** e **Inter**. Importar siempre
desde Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

| Rol | Fuente | Peso | Uso |
|-----|--------|------|-----|
| Wordmark / display | **Anton** | 400 | La palabra "Cíclico", números/datos grandes de impacto, hero numbers. Condensada pesada, siempre UPPERCASE. |
| Titulares | **Poppins** | 600–800 | Hero, títulos de sección (h1–h3), títulos de tarjeta. |
| Cuerpo / UI | **Inter** | 400–600 | Párrafos, botones, navegación, labels, UI general. |

Anton solo tiene un peso (400) y rinde en mayúsculas: usarla para el wordmark y números
grandes, nunca para texto corrido. Para labels/etiquetas técnicas usar **Inter** en
uppercase con `letter-spacing` (no hace falta una mono de marca). Para texto monoespaciado
funcional (consolas de log, snippets de código) usar la mono del sistema:
`--mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;`.

**Escala tipográfica:**
- Wordmark / número hero: Anton, `clamp(40px, 8vw, 96px)`, uppercase
- Hero (h1): `clamp(40px, 6.5vw, 68px)`, Poppins 800, `letter-spacing: -0.02em`, `line-height: 1.02`
- Sección (h2): `26px`, Poppins 700, `letter-spacing: -0.01em`
- Subtítulo: `19px`, Inter
- Cuerpo: `15–17px`, Inter, `line-height: 1.65`
- Labels: `11–12px`, Inter 600, `letter-spacing: 0.08–0.12em`, uppercase

```css
body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
h1, h2, h3 { font-family: 'Poppins', sans-serif; }
.display { font-family: 'Anton', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: 0.01em; }
```

---

## El logo

El logo de Cíclico es un **archivo de imagen**: la marca son los **círculos concéntricos**
(espiral) + **"CÍ CLI CO"** apilado en tipografía pesada condensada. El archivo oficial es
la versión **negra sobre fondo transparente** (`logo.png`, monocromo).

Como es monocromo y transparente, **no hacen falta dos archivos**: se usa la versión negra
y se **invierte a blanco en modo oscuro** con `filter: invert(1)`.

```html
<a class="brand" href="/">
  <img src="/logo.png" alt="Cíclico" class="logo-img" />
</a>
```

```css
.logo-img { height: 38px; width: auto; display: block; }
/* negro sobre transparente → en oscuro lo pasamos a blanco */
@media (prefers-color-scheme: dark) { .logo-img { filter: invert(1); } }
```

> Nunca recrear el logo con CSS ni texto. El logo es la única imagen "de marca".
> Es una composición apilada (alto ≈ ancho): para nav usar ~36–40px de alto. Si se
> necesita un lockup horizontal, pedir el asset correspondiente.

---

## Componentes base

### Nav

```html
<nav>
  <a class="brand" href="/"><img src="/logo.svg" alt="Cíclico" class="logo-img"></a>
  <div class="tag mono"><!-- etiqueta de sección --></div>
</nav>
```

```css
nav {
  padding: 16px 32px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 14px;
  position: sticky; top: 0; z-index: 100;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(12px);
}
.brand { display: flex; align-items: center; }
.logo-img { height: 26px; width: auto; display: block; }
nav .tag {
  margin-left: auto; font-size: 11px; color: var(--muted);
  border: 1px solid var(--border); padding: 4px 10px; border-radius: 20px;
  text-transform: uppercase; letter-spacing: 0.1em;
}
```

### Hero label (etiqueta sobre el título)

```html
<div class="hero-label mono">Investigación · Viajes presidenciales</div>
```

```css
.hero-label {
  font-size: 11px; color: var(--orange-ink); letter-spacing: 0.12em;
  text-transform: uppercase; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
}
.hero-label::before { content: ''; width: 24px; height: 1px; background: var(--orange); }
```

### Stats bar (3 métricas)

```css
.stats-bar {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1px; background: var(--border);
  border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
}
.stat { background: var(--bg-card); padding: 24px 28px; }
.stat-num {
  font-family: 'Anton', sans-serif; font-weight: 400; font-size: 46px; text-transform: uppercase;
  color: var(--orange-ink); line-height: 1; margin-bottom: 6px;
}
.stat-label { font-size: 13px; color: var(--muted); line-height: 1.4; }
```

### Tarjeta / card

```css
.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px; box-shadow: var(--shadow);
  transition: border-color 0.2s, transform 0.2s;
}
.card:hover { border-color: var(--orange); transform: translateY(-1px); }
```

### Barra comparativa

```css
.bar-track { background: var(--bg-card2); border-radius: 4px; height: 10px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 4px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
.bar-orange { background: var(--orange); }
.bar-green  { background: var(--green); }
```

### Botones

```css
.btn-primary {
  background: var(--orange); color: #fff; border: none;
  font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600;
  padding: 13px 26px; border-radius: 10px; cursor: pointer;
  letter-spacing: 0.01em; transition: all 0.2s;
}
.btn-primary:hover { background: var(--orange-dim); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.btn-ghost {
  background: none; border: 1px solid var(--border); color: var(--text);
  font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
  padding: 12px 22px; border-radius: 10px; cursor: pointer; transition: all 0.2s;
}
.btn-ghost:hover { border-color: var(--orange); color: var(--orange-ink); }

.btn-add {
  background: none; border: 1px dashed var(--border); color: var(--muted);
  font-size: 13px; padding: 10px 16px; border-radius: 8px; cursor: pointer;
  width: 100%; transition: all 0.2s;
}
.btn-add:hover { border-color: var(--orange); color: var(--orange-ink); }
```

### Inputs / selects

```css
select, input[type="text"], input[type="number"], input[type="password"] {
  background: var(--bg-card2); border: 1px solid var(--border);
  color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px;
  padding: 12px 14px; border-radius: 8px; width: 100%; outline: none;
  transition: border-color 0.2s;
}
input:focus, select:focus { border-color: var(--orange); }
::placeholder { color: var(--muted); }
```

### Verdict box (conclusión con borde lateral)

```css
.verdict-box {
  background: var(--bg-card2); border-left: 3px solid var(--orange);
  border-radius: 0 10px 10px 0; padding: 20px 24px; font-size: 15px; line-height: 1.6;
}
.verdict-box strong { color: var(--orange-ink); }
```

### Nota al pie

```css
.nota {
  font-family: 'Inter', sans-serif; font-size: 11px; color: var(--muted);
  padding: 20px 32px; border-top: 1px solid var(--border); line-height: 1.6;
}
```

---

## Layout

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); }

.container { max-width: 1100px; margin: 0 auto; padding: 56px 32px; }
section { max-width: 1100px; margin: 0 auto; padding: 56px 32px; border-bottom: 1px solid var(--border); }

.grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
```

---

## Íconos SVG

Siempre SVG inline, nunca librerías. Color: `currentColor` o `var(--orange)`. Para mapas,
infografías o íconos: generar SVG inline con formas geométricas simples. No usar imágenes
externas ni emojis como íconos principales. (El logo es la única imagen "de marca".)

---

## Animaciones

```css
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.fade-in { animation: fadeIn 0.25s ease; }
```

Reservar animación para: aparición de resultados, barras comparativas y acciones que el
usuario dispara. Nada de entradas masivas.

---

## Compartir (Web Share API)

```javascript
function compartir(texto, url) {
  const shareUrl = url || window.location.href;
  if (navigator.share) navigator.share({ title: 'Cíclico', text: texto, url: shareUrl });
  else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto + ' ' + shareUrl)}`, '_blank');
}
```

---

## Haversine (distancias aéreas)

```javascript
function haversine(lat1, lon1, lat2, lon2, unit = 'miles') {
  const R = unit === 'km' ? 6371 : 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## Responsivo (mobile-first)

```css
@media (max-width: 640px) {
  nav { padding: 14px 20px; }
  section, .container { padding: 40px 20px; }
  .stats-bar, .grid-2 { grid-template-columns: 1fr; }
}
```

---

## Checklist antes de entregar

- [ ] Variables `:root` (claro) + bloque `@media (prefers-color-scheme: dark)` definidos
- [ ] Las tres fuentes de marca (Anton, Poppins, Inter) importadas desde Google Fonts
- [ ] Wordmark/números en Anton, titulares en Poppins, cuerpo y labels en Inter
- [ ] Logo como `<img src="/logo.svg">` (nunca recreado en CSS/texto)
- [ ] `max-width: 1100px; margin: 0 auto` en el contenedor; `box-sizing: border-box` en `*`
- [ ] Naranja como único acento; `--orange-ink` para texto/links en claro
- [ ] Sin blanco puro ni negro puro; sin gradientes de color
- [ ] Botón de compartir con Web Share API + fallback a Twitter (si aplica)
- [ ] Media query mobile (max-width: 640px); nota al pie con fuentes si es herramienta de datos
- [ ] Archivo único autocontenido (sin imports externos salvo Google Fonts + el logo)
```
