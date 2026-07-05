import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';

export type PharmacyProductSeed = any;

const quantityConfig = (unitLabel = 'علبة') => ({
  quantity: { unit_label: unitLabel },
});

export const pharmacyProducts: PharmacyProductSeed[] = [
  {
    name: 'آيه كريم مرطب 50 جم',
    category: 'عناية شخصية',
    current_price: 42,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'ايه كريم مرطب 50 جم',
    category: 'عناية شخصية',
    current_price: 42,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'اية كريم مرطب 50 جم',
    category: 'عناية شخصية',
    current_price: 42,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'بنادول إكسترا 24 قرص',
    category: 'أدوية',
    current_price: 35,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'أدول 500 مجم 24 قرص',
    category: 'أدوية',
    current_price: 20,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'بروفين 400 مجم 30 قرص',
    category: 'أدوية',
    current_price: 45,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'كونجستال 20 قرص',
    category: 'أدوية',
    current_price: 30,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'سيتال 500 مجم 20 قرص',
    category: 'أدوية',
    current_price: 15,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'أوتريفين بخاخ للأنف للكبار',
    category: 'أدوية',
    current_price: 25,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('زجاجة'),
  },
  {
    name: 'أوجمنتين 1 جم 14 قرص',
    category: 'أدوية',
    current_price: 110,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'فيتامين سي 1000 مجم 20 قرص فوار',
    category: 'أدوية',
    current_price: 55,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'سانسوفيت شراب بالكالسيوم 200 مل',
    category: 'أدوية',
    current_price: 48,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('زجاجة'),
  },
  {
    name: 'شامبو دوف لتساقط الشعر 400 مل',
    category: 'عناية شخصية',
    current_price: 95,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('عبوة'),
  },
  {
    name: 'معجون أسنان سنسوداين 75 مل',
    category: 'عناية شخصية',
    current_price: 75,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('عبوة'),
  },
  {
    name: 'غسول فم ليسترين بالنعناع 250 مل',
    category: 'عناية شخصية',
    current_price: 65,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('زجاجة'),
  },
  {
    name: 'كريم مرطب نيفيا الأزرق 150 مل',
    category: 'عناية شخصية',
    current_price: 80,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('علبة'),
  },
  {
    name: 'صابونة دوف بيضاء 135 جم',
    category: 'عناية شخصية',
    current_price: 35,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('قطعة'),
  },
  {
    name: 'شاور جل لايفبوي 500 مل',
    category: 'عناية شخصية',
    current_price: 85,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('عبوة'),
  },
  {
    name: 'شامبو جونسون للأطفال 500 مل',
    category: 'عناية شخصية',
    current_price: 75,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: quantityConfig('عبوة'),
  },
];
