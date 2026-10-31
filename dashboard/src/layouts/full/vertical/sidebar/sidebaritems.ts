export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: string;
  children?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
  disabled?: boolean;
  subtitle?: string;
  badge?: boolean;
  badgeType?: string;
  isPro?: boolean;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: string;
  id?: number | string;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: string;
  disabled?: boolean;
  subtitle?: string;
  badgeType?: string;
  badge?: boolean;
  isPro?: boolean;
}

import { uniqueId } from 'lodash';

// Menu du projet : uniquement les modules réellement disponibles.
const SidebarContent: MenuItem[] = [
  {
    heading: 'Plateforme',
    children: [
      {
        id: uniqueId(),
        name: 'Accueil',
        icon: 'solar:widget-2-linear',
        url: '/',
        isPro: false,
      },
      {
        id: uniqueId(),
        name: 'Ontologie Éducation',
        icon: 'solar:graph-outline',
        url: '/education',
        isPro: false,
      },
      {
        id: uniqueId(),
        name: 'Évaluations & Certifications',
        icon: 'solar:medal-ribbon-star-linear',
        url: '/evaluations',
        isPro: false,
      },
      {
        id: uniqueId(),
        name: 'Utilisateurs',
        icon: 'solar:users-group-rounded-linear',
        url: '/utilisateurs',
        isPro: false,
      },
    ],
  },
];

export default SidebarContent;
