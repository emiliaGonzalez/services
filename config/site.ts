export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Brytspace",
  description: "Plataforma para proveedores de eventos",
  navItems: [
    { label: "Eventos", href: "/eventos" },
    { label: "Servicios", href: "/servicios" },
  ],
};

export const serviceCategories = [
  { id: "actividades", label: "Actividades y Talleres", icon: "palette" },
  { id: "catering", label: "Catering", icon: "utensils" },
  { id: "decoracion", label: "Decoración", icon: "flower" },
  { id: "diseno", label: "Diseño", icon: "pen-tool" },
  { id: "espacio", label: "Espacio", icon: "building" },
  { id: "fotografia", label: "Fotografía y Video", icon: "camera" },
  { id: "luces", label: "Luces y Sonido", icon: "lightbulb" },
  { id: "merchandising", label: "Merchandising", icon: "gift" },
  { id: "mobiliario", label: "Mobiliario", icon: "armchair" },
  { id: "musica", label: "Música", icon: "music" },
  { id: "personal", label: "Personal", icon: "users" },
  { id: "pr", label: "PR & Social", icon: "megaphone" },
  { id: "transporte", label: "Transporte", icon: "truck" },
] as const;
