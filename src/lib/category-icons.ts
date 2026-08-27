import type { ComponentType } from "react";
import {
  // Finance & Shopping
  MoneyIcon, PiggyBankIcon, WalletIcon, BankIcon, CoinIcon, CoinsIcon,
  CreditCardIcon, ReceiptIcon, ChartBarIcon, ChartLineIcon, CurrencyDollarIcon,
  CurrencyEurIcon, CurrencyBtcIcon, VaultIcon, ShoppingCartIcon, ShoppingBagIcon,
  StorefrontIcon, HandbagIcon, BarcodeIcon, QrCodeIcon,
  // Home & Utilities
  HouseIcon, BuildingsIcon, WrenchIcon, HammerIcon, PaintBrushIcon,
  LightbulbIcon, PlugIcon, WifiHighIcon, TelevisionIcon, CouchIcon,
  BedIcon, ToiletIcon, ShowerIcon, BathtubIcon, ChairIcon,
  // Food & Drink
  ForkKnifeIcon, CookingPotIcon, CoffeeIcon, WineIcon, BeerBottleIcon,
  PizzaIcon, HamburgerIcon, FishSimpleIcon, CarrotIcon,
  // Clothing & Accessories
  SneakerIcon, TShirtIcon, CoatHangerIcon, BriefcaseIcon,
  // Transport & Travel
  CarIcon, CarProfileIcon, TaxiIcon, BusIcon, TrainIcon,
  AirplaneIcon, AirplaneTiltIcon, AirplaneTakeoffIcon, AirplaneLandingIcon,
  BicycleIcon, MotorcycleIcon, BoatIcon, RocketIcon, GasPumpIcon,
  ChargingStationIcon, RoadHorizonIcon, MapPinIcon, MapTrifoldIcon, CompassIcon,
  // Health & Education
  HeartbeatIcon, StethoscopeIcon, SyringeIcon, PillIcon, FirstAidIcon,
  PrescriptionIcon, GraduationCapIcon, BookOpenIcon, BookIcon, BooksIcon,
  PenIcon, PencilIcon, ChalkboardIcon, BackpackIcon, BrainIcon,
  // Entertainment & Tech
  FilmStripIcon, TicketIcon, GameControllerIcon, HeadphonesIcon,
  SpeakerHighIcon, MicrophoneIcon, GuitarIcon, CameraIcon, VideoCameraIcon,
  LaptopIcon, DesktopIcon, DeviceMobileIcon, WatchIcon, CloudIcon,
  DiceFiveIcon, PuzzlePieceIcon, HeadsetIcon,
  // Nature & Pets
  CatIcon, DogIcon, BirdIcon, PawPrintIcon, FlowerIcon,
  FlowerTulipIcon, LeafIcon, TreeIcon, SunIcon, MoonIcon,
  CloudRainIcon, SnowflakeIcon, UmbrellaIcon, FireIcon, DropIcon,
  CampfireIcon, MountainsIcon,
  // Events & Misc
  BabyIcon, GiftIcon, ConfettiIcon, BalloonIcon, CakeIcon,
  SmileyIcon, TagIcon, CalendarIcon, BellIcon, BarbellIcon,

  type IconProps,
} from "@phosphor-icons/react";

export const CATEGORY_ICONS: Record<string, ComponentType<IconProps>> = {
  // Finance & Shopping
  Money: MoneyIcon, PiggyBank: PiggyBankIcon, Wallet: WalletIcon, Bank: BankIcon,
  Coin: CoinIcon, Coins: CoinsIcon, CreditCard: CreditCardIcon, Receipt: ReceiptIcon,
  ChartBar: ChartBarIcon, ChartLine: ChartLineIcon, CurrencyDollar: CurrencyDollarIcon,
  CurrencyEur: CurrencyEurIcon, CurrencyBtc: CurrencyBtcIcon, Vault: VaultIcon,
  ShoppingCart: ShoppingCartIcon, ShoppingBag: ShoppingBagIcon, Storefront: StorefrontIcon,
  Handbag: HandbagIcon, Barcode: BarcodeIcon, QrCode: QrCodeIcon,
  // Home & Utilities
  House: HouseIcon, Buildings: BuildingsIcon, Wrench: WrenchIcon, Hammer: HammerIcon,
  PaintBrush: PaintBrushIcon, Lightbulb: LightbulbIcon, Plug: PlugIcon, WifiHigh: WifiHighIcon,
  Television: TelevisionIcon, Couch: CouchIcon, Bed: BedIcon, Toilet: ToiletIcon,
  Shower: ShowerIcon, Bathtub: BathtubIcon, Chair: ChairIcon,
  // Food & Drink
  ForkKnife: ForkKnifeIcon, CookingPot: CookingPotIcon, Coffee: CoffeeIcon, Wine: WineIcon,
  BeerBottle: BeerBottleIcon, Pizza: PizzaIcon, Hamburger: HamburgerIcon, FishSimple: FishSimpleIcon,
  Carrot: CarrotIcon,
  // Clothing & Accessories
  Sneaker: SneakerIcon, TShirt: TShirtIcon, CoatHanger: CoatHangerIcon, Briefcase: BriefcaseIcon,
  // Transport & Travel
  Car: CarIcon, CarProfile: CarProfileIcon, Taxi: TaxiIcon, Bus: BusIcon, Train: TrainIcon,
  Airplane: AirplaneIcon, AirplaneTilt: AirplaneTiltIcon, AirplaneTakeoff: AirplaneTakeoffIcon,
  AirplaneLanding: AirplaneLandingIcon, Bicycle: BicycleIcon, Motorcycle: MotorcycleIcon,
  Boat: BoatIcon, Rocket: RocketIcon, GasPump: GasPumpIcon, ChargingStation: ChargingStationIcon,
  RoadHorizon: RoadHorizonIcon, MapPin: MapPinIcon, MapTrifold: MapTrifoldIcon, Compass: CompassIcon,
  // Health & Education
  Heartbeat: HeartbeatIcon, Stethoscope: StethoscopeIcon, Syringe: SyringeIcon, Pill: PillIcon,
  FirstAid: FirstAidIcon, Prescription: PrescriptionIcon, GraduationCap: GraduationCapIcon,
  BookOpen: BookOpenIcon, Book: BookIcon, Books: BooksIcon, Pen: PenIcon, Pencil: PencilIcon,
  Chalkboard: ChalkboardIcon, Backpack: BackpackIcon, Brain: BrainIcon,
  // Entertainment & Tech
  FilmStrip: FilmStripIcon, Ticket: TicketIcon, GameController: GameControllerIcon,
  Headphones: HeadphonesIcon, SpeakerHigh: SpeakerHighIcon, Microphone: MicrophoneIcon,
  Guitar: GuitarIcon, Camera: CameraIcon, VideoCamera: VideoCameraIcon, Laptop: LaptopIcon,
  Desktop: DesktopIcon, DeviceMobile: DeviceMobileIcon, Watch: WatchIcon, Cloud: CloudIcon,
  DiceFive: DiceFiveIcon, PuzzlePiece: PuzzlePieceIcon, Headset: HeadsetIcon,
  // Nature & Pets
  Cat: CatIcon, Dog: DogIcon, Bird: BirdIcon, PawPrint: PawPrintIcon, Flower: FlowerIcon,
  FlowerTulip: FlowerTulipIcon, Leaf: LeafIcon, Tree: TreeIcon, Sun: SunIcon, Moon: MoonIcon,
  CloudRain: CloudRainIcon, Snowflake: SnowflakeIcon, Umbrella: UmbrellaIcon, Fire: FireIcon,
  Drop: DropIcon, Campfire: CampfireIcon, Mountains: MountainsIcon,
  // Events & Misc
  Baby: BabyIcon, Gift: GiftIcon, Confetti: ConfettiIcon, Balloon: BalloonIcon, Cake: CakeIcon,
  Smiley: SmileyIcon, Tag: TagIcon, Calendar: CalendarIcon, Bell: BellIcon, Barbell: BarbellIcon,
};

export const AVAILABLE_ICONS = Object.keys(CATEGORY_ICONS);

export function resolveCategoryIcon(
  icon: string | null | undefined,
): ComponentType<IconProps> {
  if (!icon) return TagIcon;
  return CATEGORY_ICONS[icon] ?? TagIcon;
}
