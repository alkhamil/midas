import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { NavItemType } from "../shared/types/navigation";
import { LayoutDashboard, Database, Settings, SlidersHorizontal, Users } from "lucide-react";
import { useDynamicDefinitions } from "../modules/generator/runtime/hooks";
import { buildDynamicNavItems } from "../modules/generator/runtime/dynamicNav";

export const navItems: NavItemType[] = [
  {
    label: "Dashboard",
    labelKey: "nav.dashboard",
    path: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Generator",
    labelKey: "nav.generator",
    path: "/generator",
    icon: <Settings className="h-5 w-5" />,
  },
  {
    label: "Component",
    labelKey: "nav.components",
    icon: <Database className="h-5 w-5" />,
    children: [
      {
        label: "Typography",
        labelKey: "nav.typography",
        path: "/components/typography",
      },
      { label: "Colors", labelKey: "nav.colors", path: "/components/colors" },
      { label: "UI", labelKey: "nav.ui", path: "/components/ui" },
    ],
  },
  {
    label: "User Management",
    labelKey: "user.navGroup",
    icon: <Users className="h-5 w-5" />,
    children: [
      {
        label: "Users",
        labelKey: "user.labelPlural",
        path: "/user-management/user",
        permissionKey: "master-user.view",
      },
      {
        label: "Roles",
        labelKey: "role.labelPlural",
        path: "/user-management/role",
        permissionKey: "master-role.view",
      },
    ],
  },
  {
    label: "Settings",
    labelKey: "settings.title",
    path: "/settings",
    icon: <SlidersHorizontal className="h-5 w-5" />,
    permissionKey: "settings.view",
  },
            {
              label: 'Regions',
              labelKey: 'region.labelPlural',
              path: '/regions',
              icon: <Database className="h-5 w-5" />,
              permissionKey: 'region.view',
            },
            // __GENERATOR_NAV_ITEMS__
];

/** Item nav dari definisi published (flat untuk root, group per parent). */
export function useDynamicNavItems(): NavItemType[] {
  const { i18n } = useTranslation();
  const { data } = useDynamicDefinitions("published");
  return useMemo(
    () => (data ? buildDynamicNavItems(data) : []),
    [data, i18n.language],
  );
}

/**
 * Gabung nav statis + dinamis tanpa duplikat: modul hasil generate-ke-repo
 * (statis, menutupi versi dinamis di route sama) menang — entri dinamis
 * dengan path yang sudah ada dilewati, anak grup digabung per path.
 * Tidak memutasi array statis.
 */
export function mergeNavItems(
  staticItems: NavItemType[],
  dynamicItems: NavItemType[],
): NavItemType[] {
  const merged: NavItemType[] = staticItems.map((item) => ({
    ...item,
    children: item.children ? [...item.children] : undefined,
  }));
  const usedPaths = new Set<string>();
  for (const item of merged) {
    if (item.path) usedPaths.add(item.path);
    for (const child of item.children ?? []) usedPaths.add(child.path);
  }
  for (const dyn of dynamicItems) {
    if (dyn.children) {
      const group = merged.find(
        (item) => item.label === dyn.label && item.children,
      );
      if (!group) {
        merged.push(dyn);
        for (const child of dyn.children) usedPaths.add(child.path);
        continue;
      }
      for (const child of dyn.children) {
        if (!usedPaths.has(child.path)) {
          group.children!.push(child);
          usedPaths.add(child.path);
        }
      }
      continue;
    }
    if (dyn.path && !usedPaths.has(dyn.path)) {
      merged.push(dyn);
      usedPaths.add(dyn.path);
    }
  }
  return merged;
}
