/**
 * Static, tree-shakeable Lucide icon registry.
 *
 * Replaces the previous runtime `import { icons } from 'lucide-react'`
 * (which forced the entire ~500KB icon library into the bundle) with an
 * explicit allow-list of every icon string used by:
 *   - the database (categories, gamification_levels, menu_items,
 *     plan_resources, popular_services, community_links, courses,
 *     home_steps, home_cta_blocks, profile_type_settings, highlights)
 *   - hand-written admin/menu defaults
 *
 * Adding a new icon: import it below and add to the map.
 * Unknown / legacy / emoji values gracefully fall back to CircleDot.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Accessibility, Activity, Anchor, Archive, Armchair, ArrowDown, ArrowUp, ArrowUpCircle, Award,
  Baby, Banknote, BarChart3, BatteryCharging, Bell, Bike, Blocks, BookOpen, Book, Bookmark, Bot, Box,
  Brain, Briefcase, Brush, Bug, Building, Building2, Bus,
  Cable, Cake, Calculator, CalendarDays, Camera, Car, CarFront, Castle, Cctv, ChefHat, ChevronRight,
  Church, Circle, CircleDot, CircuitBoard, Clapperboard, ClipboardCheck, ClipboardList, Clock, Cloud,
  Code, Code2, Codesandbox, Coffee, Cog, Compass, Construction, Container, Cookie, CookingPot, Copy, Cpu, Croissant, Crown,
  Database, Disc, Dog, DollarSign, DoorOpen, Drill, Droplet, Droplets, Dumbbell,
  Eye, ExternalLink,
  Factory, Fan, Fence, Figma, FileChartLine, FileCheck, FileCode, Files, FileSearch, FileText, Film, Fingerprint,
  Flame, FlaskConical, Flower, Flower2, FolderOpen, Footprints,
  Gamepad2, Gauge, Gavel, Gem, GlassWater, Globe, GraduationCap, GripVertical,
  Hammer, Hand, HandHeart, Handshake, HardDrive, HardHat, Headphones, Headset, Heart, HeartHandshake, HeartPulse, HelpCircle, Home,
  IceCream, Image, Info,
  Key, Keyboard,
  Languages, Laptop, Layers, Layout, LayoutDashboard, LayoutGrid, Leaf, Lightbulb, LineChart, Lock, LogIn,
  Mail, Map, MapPin, Maximize, Megaphone, Menu, MessageCircle, MessageSquare, Mic, Mic2, Microscope, Microwave,
  Monitor, Mountain, MountainSnow, MoveUp, Music, Music2,
  Navigation, Needle, Network, Newspaper,
  Package, Paintbrush, PaintBucket, Palette, PartyPopper, PawPrint, Pen, PenLine, PenTool, Pencil, Phone,
  PiggyBank, Pipette, Pizza, Plane, Plug, Plus, Presentation, Printer, Puzzle,
  Radio, Recycle, Rocket, Ruler,
  Salad, Satellite, Save, Scale, Scan, Scissors, Scroll, Search, SearchCheck, Settings, Settings2, Share2,
  Shield, ShieldAlert, ShieldCheck, Ship, Shirt, ShoppingBag, ShoppingCart, Smartphone, Snowflake, Sofa,
  Sparkles, Speaker, SprayCan, Sprout, SquarePlus, Star, Stethoscope, Store, StretchHorizontal, Sun, Syringe,
  Table, Target, Terminal, Thermometer, ThermometerSnowflake, ThermometerSun, Tractor, Trash2, TreePine, Trees,
  TrendingUp, Trophy, Truck, Tv,
  User, UserCheck, UserCog, UserPlus, Users, Users2, Utensils, UtensilsCrossed,
  Video,
  Wallpaper, WashingMachine, Waves, Wind, Wine, Wrench,
  Zap, ZapOff,
} from 'lucide-react';

/**
 * Master registry: PascalCase name → Lucide component.
 * Keys mirror exactly the values stored by the admin in the database
 * (`categories.icon`, `menu_items.icon`, etc.).
 */
export const ICON_LIBRARY: Record<string, LucideIcon> = {
  Accessibility, Activity, Anchor, Archive, Armchair, ArrowDown, ArrowUp, ArrowUpCircle, Award,
  Baby, Banknote, BarChart3, BatteryCharging, Bell, Bike, Blocks, BookOpen, Book, Bookmark, Bot, Box,
  Brain, Briefcase, Brush, Bug, Building, Building2, Bus,
  Cable, Cake, Calculator, CalendarDays, Camera, Car, CarFront, Castle, Cctv, ChefHat, ChevronRight,
  Church, Circle, CircleDot, CircuitBoard, Clapperboard, ClipboardCheck, ClipboardList, Clock, Cloud,
  Code, Code2, Codesandbox, Coffee, Cog, Compass, Construction, Container, Cookie, CookingPot, Copy, Cpu, Croissant, Crown,
  Database, Disc, Dog, DollarSign, DoorOpen, Drill, Droplet, Droplets, Dumbbell,
  Eye, ExternalLink,
  Factory, Fan, Fence, Figma, FileChartLine, FileCheck, FileCode, Files, FileSearch, FileText, Film, Fingerprint,
  Flame, FlaskConical, Flower, Flower2, FolderOpen, Footprints,
  Gamepad2, Gauge, Gavel, Gem, GlassWater, Globe, GraduationCap, GripVertical,
  Hammer, Hand, HandHeart, Handshake, HardDrive, HardHat, Headphones,
  // Common DB alias kept for back-compat with rows that store "HeadphonesIcon"
  HeadphonesIcon: Headphones,
  Headset, Heart, HeartHandshake, HeartPulse, HelpCircle, Home,
  IceCream, Image, ImageIcon: Image,
  Info,
  Key, Keyboard,
  Languages, Laptop, Layers, Layout, LayoutDashboard, LayoutGrid, Leaf, Lightbulb, LineChart, Lock, LogIn,
  Mail, Map, MapPin, Maximize, Megaphone, Menu, MenuIcon: Menu,
  MessageCircle, MessageSquare, MessageSquareQuote: MessageSquare,
  Mic, Mic2, Microscope, Microwave,
  Monitor, Mountain, MountainSnow, MoveUp, Music, Music2,
  Navigation, Needle, Network, Newspaper,
  Package, Paintbrush, PaintBucket, Palette, PartyPopper, PawPrint, Pen, PenLine, PenTool, Pencil, Phone,
  PiggyBank, Pipette, Pizza, Plane, Plug, Plus, Presentation, Printer, Puzzle,
  Radio, Recycle, Rocket, Ruler,
  Salad, Satellite, Save, Scale, Scan, Scissors, Scroll, Search, SearchCheck, Settings, Settings2, Share2,
  Shield, ShieldAlert, ShieldCheck, Ship, Shirt, ShoppingBag, ShoppingCart, Smartphone, Snowflake, Sofa,
  Sparkles, Speaker, SprayCan, Sprout, SquarePlus, Star, Stethoscope, Store, StretchHorizontal, Sun, Syringe,
  Table, Target, Terminal, Thermometer, ThermometerSnowflake, ThermometerSun, Tractor, Trash2, TreePine, Trees,
  TrendingUp, Trophy, Truck, Tv,
  User, UserCheck, UserCog, UserPlus, Users, Users2, Utensils, UtensilsCrossed,
  Video,
  Wallpaper, WashingMachine, Waves, Wind, Wine, Wrench,
  Zap, ZapOff,
};

/** Lower-cased lookup table built once for case-insensitive resolution. */
const LOWER_LOOKUP: Record<string, LucideIcon> = (() => {
  const out: Record<string, LucideIcon> = {};
  for (const [k, v] of Object.entries(ICON_LIBRARY)) out[k.toLowerCase()] = v;
  return out;
})();

/** Convert "circle-dot" / "circle_dot" / "circle dot" → "CircleDot" */
const kebabToPascal = (s: string): string =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');

/**
 * Resolve a database icon string to a Lucide component.
 * Returns `null` when nothing matches — caller should render a fallback.
 */
export function resolveIcon(name?: string | null): LucideIcon | null {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  return (
    ICON_LIBRARY[trimmed] ??
    LOWER_LOOKUP[trimmed.toLowerCase()] ??
    LOWER_LOOKUP[kebabToPascal(trimmed).toLowerCase()] ??
    null
  );
}
