# Agendapy — Sistema de diseño

Biblioteca de componentes local, fuente de verdad para el proyecto de diseño en claude.ai/design.
Los valores se extrajeron de las CSS Modules reales de la app (`app/landing.module.css`,
`app/[slug]/booking.module.css`, etc.), no son inventados.

## Tokens

| Token | Valor |
|---|---|
| Green / primary | `#00C48C` |
| Green / hover | `#009E71` |
| Mint / tint | `#E6FAF4` |
| Ink / foreground | `#1A1A2E` |
| Muted | `#4A4A6A` |
| Faint / placeholder | `#B0B3C1` |
| Border | `#E8EAF0` |
| Surface | `#F5F7FA` |
| Radios | 8 · 10 · 14 · 16 · 18 · 100px |
| Sombra card | `0 8px 30px rgba(0,0,0,.06)` |
| Tipografía | Arial / Helvetica sans · pesos 400–800 |

## Estructura

- `tokens/` — colores, tipografía
- `components/` — botones, inputs, badges, cards, slots, alerts, step-progress

## Sync

Editá los archivos locales y volvé a correr `/design-sync` para empujar los cambios al
proyecto de claude.ai/design, un componente a la vez.
