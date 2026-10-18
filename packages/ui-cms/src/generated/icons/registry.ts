// Semua ikon berdasarkan nama — dipakai <Icon name>. Mengimpor file ini memuat semua ikon.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { AddIcon } from './AddIcon';
import { AltArrowDownIcon } from './AltArrowDownIcon';
import { AltArrowLeftIcon } from './AltArrowLeftIcon';
import { AltArrowRightIcon } from './AltArrowRightIcon';
import { AltArrowUpIcon } from './AltArrowUpIcon';
import { ArrowDownIcon } from './ArrowDownIcon';
import { ArrowUpIcon } from './ArrowUpIcon';
import { ChartIcon } from './ChartIcon';
import { CheckCircleIcon } from './CheckCircleIcon';
import { CloseIcon } from './CloseIcon';
import { CloseCircleIcon } from './CloseCircleIcon';
import { DangerTriangleIcon } from './DangerTriangleIcon';
import { DoubleAltArrowLeftIcon } from './DoubleAltArrowLeftIcon';
import { DoubleAltArrowRightIcon } from './DoubleAltArrowRightIcon';
import { EyeIcon } from './EyeIcon';
import { EyeClosedIcon } from './EyeClosedIcon';
import { FilterIcon } from './FilterIcon';
import { HamburgerMenuIcon } from './HamburgerMenuIcon';
import { InfoCircleIcon } from './InfoCircleIcon';
import { LogoutIcon } from './LogoutIcon';
import { MagniferIcon } from './MagniferIcon';
import { PenIcon } from './PenIcon';
import { SettingsIcon } from './SettingsIcon';
import { ShieldCheckIcon } from './ShieldCheckIcon';
import { TrashBinIcon } from './TrashBinIcon';
import { UserIcon } from './UserIcon';
import { WidgetIcon } from './WidgetIcon';

export const iconRegistry = {
  "add": AddIcon,
  "alt-arrow-down": AltArrowDownIcon,
  "alt-arrow-left": AltArrowLeftIcon,
  "alt-arrow-right": AltArrowRightIcon,
  "alt-arrow-up": AltArrowUpIcon,
  "arrow-down": ArrowDownIcon,
  "arrow-up": ArrowUpIcon,
  "chart": ChartIcon,
  "check-circle": CheckCircleIcon,
  "close": CloseIcon,
  "close-circle": CloseCircleIcon,
  "danger-triangle": DangerTriangleIcon,
  "double-alt-arrow-left": DoubleAltArrowLeftIcon,
  "double-alt-arrow-right": DoubleAltArrowRightIcon,
  "eye": EyeIcon,
  "eye-closed": EyeClosedIcon,
  "filter": FilterIcon,
  "hamburger-menu": HamburgerMenuIcon,
  "info-circle": InfoCircleIcon,
  "logout": LogoutIcon,
  "magnifer": MagniferIcon,
  "pen": PenIcon,
  "settings": SettingsIcon,
  "shield-check": ShieldCheckIcon,
  "trash-bin": TrashBinIcon,
  "user": UserIcon,
  "widget": WidgetIcon,
} as const;

export type IconName = keyof typeof iconRegistry;
// Literal (bukan Object.keys) supaya registry tidak ikut terbundel bila tidak dipakai.
export const iconNames: IconName[] = ["add", "alt-arrow-down", "alt-arrow-left", "alt-arrow-right", "alt-arrow-up", "arrow-down", "arrow-up", "chart", "check-circle", "close", "close-circle", "danger-triangle", "double-alt-arrow-left", "double-alt-arrow-right", "eye", "eye-closed", "filter", "hamburger-menu", "info-circle", "logout", "magnifer", "pen", "settings", "shield-check", "trash-bin", "user", "widget"];
